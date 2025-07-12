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
    <div className="min-h-screen flex flex-col items-center relative px-2 sm:px-4 md:px-8 lg:px-16 xl:px-32 mt-[80px]" style={{ fontFamily: 'Roboto, Arial, sans-serif' }}>
      {/* Page header with violet to purple gradient and right-aligned title */}
      <div
        className="w-screen h-[80px] fixed top-0 left-0 z-20 flex items-center justify-end pr-8"
        style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' }}
      >
        <span className="font-bold text-2xl text-white select-none" style={{ letterSpacing: '1px', userSelect: 'none' }}>
          The Web Crawler
        </span>
      </div>
      {/* Glassy purple-to-dark blue gradient background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-purple-800 to-blue-900" />
      {/* Glass effect overlay */}
      <div className="fixed inset-0 -z-10 backdrop-blur-md bg-white/10" />
      <div className="w-full max-w-xl sm:max-w-2xl md:max-w-3xl lg:max-w-4xl p-4 sm:p-8 bg-white rounded shadow-lg border-2 border-blue-800 flex flex-col items-center" style={{ marginTop: '90px' }}>
        <h2 className="text-2xl font-bold mb-6 text-center">Analysis Details</h2>
         <div className="w-full h-64 sm:h-80 md:h-96 flex items-center justify-center">
          <Bar data={data} options={options} />
        </div>
         <div className="mt-8 w-full flex flex-col items-center px-2 sm:px-4 md:px-8 lg:px-16 xl:px-32">
           <div className="mb-2 text-gray-700 break-all"><b>URL:</b> {result.url}</div>
           <div className="mb-2 text-gray-700 break-all"><b>Host name:</b> {result.hostname}</div>
           <div className="mb-2 text-gray-700 break-all"><b>Title:</b> {result.title}</div>
        </div>
         {inaccessibleLinksList.length > 0 && (
           <div className="mt-8 w-full px-2 sm:px-4 md:px-8 lg:px-16 xl:px-32">
             <h3 className="text-lg font-semibold mb-2 text-center">Inaccessible Links</h3>
             {/* Card layout for below xl */}
             <div className="flex flex-col gap-4 xl:hidden">
               {inaccessibleLinksList.map((item, idx) => (
                 <div key={idx} className={`bg-white rounded-2xl shadow-xl shadow-black border-2 border-blue-800 p-4 flex flex-col gap-2 ${idx % 2 === 0 ? 'bg-blue-50' : 'bg-blue-200'}`}>
                   <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                     <span><span className="font-bold">URL:</span> <span className="break-all">{item.url}</span></span>
                     <span><span className="font-bold">Status Code:</span> {item.status}</span>
                   </div>
                 </div>
               ))}
             </div>
             {/* Table layout for xl and above */}
             <table className="hidden xl:table min-w-full bg-white border border-gray-300 rounded text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">
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
