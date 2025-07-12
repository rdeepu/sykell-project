package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	_ "github.com/go-sql-driver/mysql"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

var db *sql.DB

// Simple API key middleware
func apiKeyAuthMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		apiKey := c.Request().Header.Get("X-API-Key")
		expectedKey := os.Getenv("API_KEY")
		if expectedKey == "" {
			expectedKey = "my-secret-key" // fallback for local dev
		}
		if apiKey != expectedKey {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid or missing API key"})
		}
		return next(c)
	}
}

func main() {

	user := os.Getenv("MYSQLUSER")
	pass := os.Getenv("MYSQLPASSWORD")
	dbname := os.Getenv("MYSQLDATABASE")
	host := os.Getenv("MYSQLHOST")
	port := os.Getenv("MYSQLPORT")

	if host == "" {
		host = "mysql" // default Docker Compose service name
	}
	if port == "" {
		port = "3306"
	}
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true", user, pass, host, port, dbname)

	var err error
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Error opening DB: %v", err)
	}

	if err := db.Ping(); err != nil {
		log.Fatalf("Error connecting to DB: %v", err)
	}

	fmt.Println("✅ Connected MySQL! on Docker")

	e := echo.New()
	e.Use(middleware.CORS())

	// Apply API key middleware to all API routes except root
	api := e.Group("")
	api.Use(apiKeyAuthMiddleware)

	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "MySQL DB Connected")
	})

	api.POST("/add-url", func(c echo.Context) error {
		type UrlRequest struct {
			Url string `json:"url"`
		}
		var req UrlRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		}
		if req.Url == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "URL is required"})
		}
		_, err := db.Exec("INSERT INTO urls (url) VALUES (?)", req.Url)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save URL"})
		}
		return c.JSON(http.StatusOK, map[string]string{"message": "URL saved"})
	})

	api.GET("/urls", func(c echo.Context) error {
		rows, err := db.Query("SELECT id, url FROM urls ORDER BY id DESC")
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch URLs"})
		}
		defer rows.Close()
		var urls []map[string]interface{}
		for rows.Next() {
			var id int
			var url string
			if err := rows.Scan(&id, &url); err != nil {
				continue
			}
			urls = append(urls, map[string]interface{}{"id": id, "url": url})
		}
		return c.JSON(http.StatusOK, urls)
	})

	api.POST("/delete-urls", func(c echo.Context) error {
		var req struct {
			IDs []int `json:"ids"`
		}
		if err := c.Bind(&req); err != nil || len(req.IDs) == 0 {
			log.Printf("Delete request bind error or empty IDs: %v, IDs: %v", err, req.IDs)
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		}
		log.Printf("Deleting IDs: %v", req.IDs)
		placeholders := make([]string, len(req.IDs))
		args := make([]interface{}, len(req.IDs))
		for i, id := range req.IDs {
			placeholders[i] = "?"
			args[i] = id
		}
		query := "DELETE FROM urls WHERE id IN (" + strings.Join(placeholders, ",") + ")"
		log.Printf("Delete query: %s, args: %v", query, args)
		_, err := db.Exec(query, args...)
		if err != nil {
			log.Printf("Delete error: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete URLs"})
		}
		return c.JSON(http.StatusOK, map[string]string{"message": "URLs deleted"})
	})

	// Add endpoint to save processed results
	api.POST("/add-result", func(c echo.Context) error {
		type Result struct {
			Url                   string `json:"url"`
			Hostname              string `json:"hostname"`
			Title                 string `json:"title"`
			HtmlVersion           string `json:"htmlVersion"`
			H1                    int    `json:"h1"`
			H2                    int    `json:"h2"`
			H3                    int    `json:"h3"`
			H4                    int    `json:"h4"`
			H5                    int    `json:"h5"`
			H6                    int    `json:"h6"`
			InternalLinks         int    `json:"internalLinks"`
			ExternalLinks         int    `json:"externalLinks"`
			InaccessibleLinks     int    `json:"inaccessibleLinks"`
			HasLoginForm          bool   `json:"hasLoginForm"`
			Error                 string `json:"error"`
			InaccessibleLinksList string `json:"inaccessibleLinksList"`
		}
		var r Result
		if err := c.Bind(&r); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		}
		_, err := db.Exec(`INSERT INTO url_results (url, hostname, title, html_version, h1, h2, h3, h4, h5, h6, internal_links, external_links, inaccessible_links, has_login_form, error, inaccessible_links_list) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			r.Url, r.Hostname, r.Title, r.HtmlVersion, r.H1, r.H2, r.H3, r.H4, r.H5, r.H6, r.InternalLinks, r.ExternalLinks, r.InaccessibleLinks, r.HasLoginForm, r.Error, r.InaccessibleLinksList)
		if err != nil {
			log.Printf("Failed to save result: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save result", "details": err.Error()})
		}
		return c.JSON(http.StatusOK, map[string]string{"message": "Result saved"})
	})

	// Endpoint to delete processed results
	api.POST("/delete-results", func(c echo.Context) error {
		type DeleteRequest struct {
			IDs []int `json:"ids"`
		}
		var req DeleteRequest
		if err := c.Bind(&req); err != nil || len(req.IDs) == 0 {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request or empty IDs"})
		}
		placeholders := make([]string, len(req.IDs))
		args := make([]interface{}, len(req.IDs))
		for i, id := range req.IDs {
			placeholders[i] = "?"
			args[i] = id
		}
		query := "DELETE FROM url_results WHERE id IN (" + strings.Join(placeholders, ",") + ")"
		_, err := db.Exec(query, args...)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete results"})
		}
		return c.JSON(http.StatusOK, map[string]string{"message": "Results deleted"})
	})

	// Endpoint to get all processed results
	api.GET("/results", func(c echo.Context) error {
		rows, err := db.Query(`SELECT id, url, hostname, title, html_version, h1, h2, h3, h4, h5, h6, internal_links, external_links, inaccessible_links, has_login_form, error, created_at, inaccessible_links_list FROM url_results ORDER BY id DESC`)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch results"})
		}
		defer rows.Close()
		var results []map[string]interface{}
		for rows.Next() {
			var id int
			var url, hostname, title, htmlVersion, errStr, inaccessibleLinksList string
			var h1, h2, h3, h4, h5, h6, internalLinks, externalLinks, inaccessibleLinks int
			var hasLoginForm bool
			var createdAt string
			if err := rows.Scan(&id, &url, &hostname, &title, &htmlVersion, &h1, &h2, &h3, &h4, &h5, &h6, &internalLinks, &externalLinks, &inaccessibleLinks, &hasLoginForm, &errStr, &createdAt, &inaccessibleLinksList); err != nil {
				continue
			}
			results = append(results, map[string]interface{}{
				"id":                    id,
				"url":                   url,
				"hostname":              hostname,
				"title":                 title,
				"htmlVersion":           htmlVersion,
				"h1":                    h1,
				"h2":                    h2,
				"h3":                    h3,
				"h4":                    h4,
				"h5":                    h5,
				"h6":                    h6,
				"internalLinks":         internalLinks,
				"externalLinks":         externalLinks,
				"inaccessibleLinks":     inaccessibleLinks,
				"hasLoginForm":          hasLoginForm,
				"error":                 errStr,
				"createdAt":             createdAt,
				"inaccessibleLinksList": inaccessibleLinksList,
			})
		}
		return c.JSON(http.StatusOK, results)
	})

	e.Logger.Fatal(e.Start(":8080"))

}
