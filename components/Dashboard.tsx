import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { DatasetImage, ClassStat } from '../types';
import { LABEL_COLORS } from '../constants';

interface DashboardProps {
  images: DatasetImage[];
}

const Dashboard: React.FC<DashboardProps> = ({ images }) => {
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    let totalBoxes = 0;
    let labeledImagesCount = 0;

    images.forEach(img => {
      if (img.boxes.length > 0) {
        labeledImagesCount++;
      }
      img.boxes.forEach(box => {
        counts[box.label] = (counts[box.label] || 0) + 1;
        totalBoxes++;
      });
    });

    const unlabeledImagesCount = images.length - labeledImagesCount;

    const data: ClassStat[] = Object.entries(counts).map(([name, count], index) => ({
      name,
      count,
      color: LABEL_COLORS[index % LABEL_COLORS.length]
    })).sort((a, b) => b.count - a.count);

    const progressData = [
      { name: 'Labeled', value: labeledImagesCount, color: '#22c55e' },   // Green
      { name: 'Unlabeled', value: unlabeledImagesCount, color: '#ef4444' } // Red
    ];

    return { data, totalBoxes, labeledImagesCount, unlabeledImagesCount, progressData };
  }, [images]);

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-900 text-white">
      <h2 className="text-3xl font-bold mb-6 text-indigo-400">Dataset Analytics</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <h3 className="text-gray-400 text-sm font-medium uppercase">Total Images</h3>
          <p className="text-4xl font-bold mt-2 text-white">{images.length}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <h3 className="text-gray-400 text-sm font-medium uppercase">Labeled</h3>
          <p className="text-4xl font-bold mt-2 text-green-500">{stats.labeledImagesCount}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <h3 className="text-gray-400 text-sm font-medium uppercase">Unlabeled</h3>
          <p className="text-4xl font-bold mt-2 text-red-500">{stats.unlabeledImagesCount}</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
          <h3 className="text-gray-400 text-sm font-medium uppercase">Total Objects</h3>
          <p className="text-4xl font-bold mt-2 text-indigo-400">{stats.totalBoxes}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-96">
        {/* Class Distribution Bar Chart */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col lg:col-span-2">
          <h3 className="text-xl font-semibold mb-4 text-gray-300">Class Distribution</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.data} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" stroke="#9ca3af" />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {stats.data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Progress Pie Chart */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col">
          <h3 className="text-xl font-semibold mb-4 text-gray-300">Labeling Progress</h3>
          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.progressData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.progressData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
            {/* Center text for percentage */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center pb-8">
                    <span className="text-3xl font-bold text-white">
                        {images.length > 0 ? Math.round((stats.labeledImagesCount / images.length) * 100) : 0}%
                    </span>
                    <p className="text-xs text-gray-400">Complete</p>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;