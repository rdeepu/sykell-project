import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const DetailsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // Get result data from location state
  const result = location.state?.result;

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-600 font-bold text-lg mb-4">No data to analyze.</div>
        <button
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => navigate(-1)}
        >
          Go Back
        </button>
      </div>
    );
  }

  const data = {
    labels: ['Internal Links', 'External Links'],
    datasets: [
      {
        label: 'Number of Links',
        data: [result.internalLinks, result.externalLinks],
        backgroundColor: [
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 99, 132, 0.7)'
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)'
        ],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: `Internal vs External Links for ${result.url}`,
        font: { size: 18 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  // Try to parse inaccessibleLinksList from result (if present)
  let inaccessibleLinksList: { url: string; status: number|string }[] = [];
  if (result.inaccessibleLinksList) {
    if (typeof result.inaccessibleLinksList === 'string') {
      try {
        inaccessibleLinksList = JSON.parse(result.inaccessibleLinksList);
      } catch {}
    } else if (Array.isArray(result.inaccessibleLinksList)) {
      inaccessibleLinksList = result.inaccessibleLinksList;
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white" style={{ fontFamily: 'Roboto, Arial, sans-serif' }}>
      <div className="w-full max-w-xl p-8 bg-white rounded shadow-lg border-2 border-blue-800 flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-6 text-center">Analysis Details</h2>
        <div className="w-full h-96 flex items-center justify-center">
          <Bar data={data} options={options} />
        </div>
        <div className="mt-8 w-full flex flex-col items-center">
          <div className="mb-2 text-gray-700"><b>URL:</b> {result.url}</div>
          <div className="mb-2 text-gray-700"><b>Host name:</b> {result.hostname}</div>
          <div className="mb-2 text-gray-700"><b>Title:</b> {result.title}</div>
        </div>
        {inaccessibleLinksList.length > 0 && (
          <div className="mt-8 w-full">
            <h3 className="text-lg font-semibold mb-2 text-center">Inaccessible Links</h3>
            <table className="min-w-full bg-white border border-gray-300 rounded">
              <thead>
                <tr>
                  <th className="px-4 py-2 border-b text-left">URL</th>
                  <th className="px-4 py-2 border-b text-left">Status Code</th>
                </tr>
              </thead>
              <tbody>
                {inaccessibleLinksList.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 border-b break-all">{item.url}</td>
                    <td className="px-4 py-2 border-b">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button
          className="mt-8 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default DetailsPage;
