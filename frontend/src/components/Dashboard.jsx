import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line } from "recharts"

const yieldData = [
  { month: "Jan", yield: 2.1 },
  { month: "Feb", yield: 2.3 },
  { month: "Mar", yield: 2.8 },
  { month: "Apr", yield: 2.6 },
  { month: "May", yield: 2.4 },
  { month: "Jun", yield: 2.2 },
]

const priceData = [
  { month: "Jan", price: 80 },
  { month: "Feb", price: 85 },
  { month: "Mar", price: 90 },
  { month: "Apr", price: 88 },
  { month: "May", price: 95 },
  { month: "Jun", price: 92 },
  { month: "Jul", price: 98 },
]

export default function DashboardContent() {
  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-green-50/30 via-emerald-50/30 to-teal-50/30 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-gray-600 text-sm mt-1">Overview of agricultural data and insights</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-200">
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
              127
            </div>
            <div className="text-sm text-gray-600 font-medium">Total Barangays</div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-200">
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            </div>
            <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
              34
            </div>
            <div className="text-sm text-gray-600 font-medium">Crops Monitored</div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-200">
          <div className="p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
              142
            </div>
            <div className="text-sm text-gray-600 font-medium">Inputs Submitted</div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-200">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Crop Yield Trends</h2>
              <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                2024
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={yieldData}>
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(value) => `${value}t`}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <Bar 
                  dataKey="yield" 
                  fill="url(#greenGradient)" 
                  radius={[8, 8, 0, 0]}
                />
                <defs>
                  <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Geospatial Map */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-200">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Geospatial Map</h2>
              <button className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium hover:bg-green-200 transition-colors">
                View Full Map
              </button>
            </div>
            <div className="h-[200px] bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl relative overflow-hidden">
              {/* Simplified map representation */}
              <div className="absolute inset-0 bg-gradient-to-br from-green-200/50 to-emerald-300/50">
                {/* Map markers */}
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-3 h-3 bg-green-600 rounded-full animate-pulse shadow-lg"
                    style={{
                      left: `${20 + (i % 4) * 20}%`,
                      top: `${25 + Math.floor(i / 4) * 25}%`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md flex gap-2">
                <button className="hover:text-green-600 transition-colors">+</button>
                <span className="text-gray-300">|</span>
                <button className="hover:text-green-600 transition-colors">-</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Crop Price Insights */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Crop Price Insights</h2>
              <p className="text-sm text-gray-600 mt-1">Market trends and price forecasts</p>
            </div>
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
              Live Data
            </span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={priceData}>
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                domain={[50, 200]} 
                tickFormatter={(value) => `₱${value}`}
                tick={{ fill: '#6b7280', fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: "#10b981", strokeWidth: 2, r: 5, stroke: "#fff" }}
                activeDot={{ r: 7, fill: "#059669" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}