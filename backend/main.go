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

	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "MySQL DB Connected")
	})

	e.POST("/add-url", func(c echo.Context) error {
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

	e.GET("/urls", func(c echo.Context) error {
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

	e.POST("/delete-urls", func(c echo.Context) error {
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

	e.Logger.Fatal(e.Start(":8080"))

}
