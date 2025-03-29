import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import Papa from 'papaparse';
import _ from 'lodash';


// Main WhatsApp Analyzer App
const WhatsAppAnalyzer = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [chatData, setChatData] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);


  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;


    setLoading(true);
    setError('');


    // Check if file is a CSV
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Please upload a CSV file.');
      setLoading(false);
      return;
    }


    const reader = new FileReader();
    
    reader.onload = (e) => {
      const csvContent = e.target.result;
      
      try {
        Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          encoding: 'utf8',
          complete: (results) => {
            // Check if the CSV has the required columns
            const requiredColumns = ['datetime', 'date', 'time', 'hour', 'weekday', 'sender', 'message'];
            const headers = results.meta.fields;
            
            const missingColumns = requiredColumns.filter(col => !headers.includes(col));
            
            if (missingColumns.length > 0) {
              setError(`CSV is missing required columns: ${missingColumns.join(', ')}`);
              setLoading(false);
              return;
            }
            
            const parsedData = results.data.map(row => ({
              ...row,
              datetime: new Date(parseDate(row.date, row.time))
            })).sort((a, b) => a.datetime - b.datetime);
            
            setChatData(parsedData);
            calculateStats(parsedData);
            setFileUploaded(true);
            setLoading(false);
            // Switch to chat tab after successful upload
            setActiveTab('chat');
          },
          error: (error) => {
            setError(`Error parsing CSV: ${error.message}`);
            setLoading(false);
          }
        });
      } catch (error) {
        setError(`Failed to process the file: ${error.message}`);
        setLoading(false);
      }
    };
    
    reader.onerror = () => {
      setError('Failed to read the file.');
      setLoading(false);
    };
    
    reader.readAsText(file);
  };


  const parseDate = (dateStr, timeStr) => {
    if (!dateStr) return null;
    
    // Try to handle different date formats
    let dateParts;
    if (dateStr.includes('/')) {
      dateParts = dateStr.split('/');
    } else if (dateStr.includes('-')) {
      dateParts = dateStr.split('-');
    } else {
      return new Date(); // Fallback to current date if format is unknown
    }
    
    if (dateParts.length !== 3) return new Date();
    
    // Handle both DD/MM/YYYY and MM/DD/YYYY formats
    // This is a simple heuristic - for a production app, more robust date parsing would be needed
    let day, month, year;
    
    // Try to determine which format is used
    if (parseInt(dateParts[0]) > 12) {
      // Likely DD/MM/YYYY
      day = parseInt(dateParts[0], 10);
      month = parseInt(dateParts[1], 10) - 1; // JavaScript months are 0-indexed
      year = parseInt(dateParts[2], 10);
    } else {
      // Could be MM/DD/YYYY or DD/MM/YYYY, default to DD/MM/YYYY
      day = parseInt(dateParts[0], 10);
      month = parseInt(dateParts[1], 10) - 1;
      year = parseInt(dateParts[2], 10);
      
      // If year is too small, might be using different order
      if (year < 100) {
        // Probably DD/MM/YY or MM/DD/YY
        year += 2000; // Assume 20xx for 2-digit years
      }
    }
    
    let hours = 0, minutes = 0;
    if (timeStr) {
      const timeParts = timeStr.split(':');
      if (timeParts.length >= 2) {
        hours = parseInt(timeParts[0], 10);
        minutes = parseInt(timeParts[1], 10);
      }
    }
    
    return new Date(year, month, day, hours, minutes);
  };


  const calculateStats = (data) => {
    if (!data || data.length === 0) return;
    
    // Get unique senders
    const uniqueSenders = [...new Set(data.map(row => row.sender))];
    
    // Message count by sender
    const messageCountBySender = {};
    uniqueSenders.forEach(sender => {
      messageCountBySender[sender] = data.filter(row => row.sender === sender).length;
    });
    
    // Word count by sender
    const wordCountBySender = {};
    uniqueSenders.forEach(sender => {
      const messages = data.filter(row => row.sender === sender).map(row => row.message);
      const wordCount = messages.reduce((total, message) => {
        if (!message) return total;
        return total + message.split(/\s+/).filter(word => word.length > 0).length;
      }, 0);
      wordCountBySender[sender] = wordCount;
    });
    
    // Message count by weekday
    const messagesByWeekday = {
      "Sunday": 0, "Monday": 0, "Tuesday": 0, "Wednesday": 0,
      "Thursday": 0, "Friday": 0, "Saturday": 0
    };
    
    // Count days per weekday for averages
    const daysByWeekday = {
      "Sunday": new Set(), "Monday": new Set(), "Tuesday": new Set(),
      "Wednesday": new Set(), "Thursday": new Set(), "Friday": new Set(), "Saturday": new Set()
    };
    
    data.forEach(row => {
      const day = row.weekday;
      if (messagesByWeekday.hasOwnProperty(day)) {
        messagesByWeekday[day]++;
        daysByWeekday[day].add(row.date);
      }
    });
    
    // Calculate average messages per weekday
    const avgMessagesByWeekday = {};
    Object.keys(messagesByWeekday).forEach(day => {
      const daysCount = daysByWeekday[day].size;
      avgMessagesByWeekday[day] = daysCount > 0 ? messagesByWeekday[day] / daysCount : 0;
    });
    
    // Message count by hour
    const messagesByHour = Array(24).fill(0);
    data.forEach(row => {
      const hour = parseInt(row.hour, 10);
      if (!isNaN(hour) && hour >= 0 && hour < 24) {
        messagesByHour[hour]++;
      }
    });
    
    // Message count by date
    const messagesByDate = {};
    data.forEach(row => {
      if (!messagesByDate[row.date]) {
        messagesByDate[row.date] = 0;
      }
      messagesByDate[row.date]++;
    });
    
    // Find most active day
    const mostActiveDay = Object.entries(messagesByDate)
      .reduce((max, [date, count]) => count > max[1] ? [date, count] : max, ['', 0]);
    
    // Timeline data (by month)
    const messagesByMonth = {};
    data.forEach(row => {
      if (!row.datetime) return;
      
      const date = row.datetime;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!messagesByMonth[monthKey]) {
        messagesByMonth[monthKey] = 0;
      }
      messagesByMonth[monthKey]++;
    });
    
    // Timeline data (by day) for bar chart
    const dailyTimelineData = Object.entries(messagesByDate)
      .map(([date, count]) => {
        // Try to create a proper date object for sorting
        const dateParts = date.split('/');
        if (dateParts.length === 3) {
          const day = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1;
          const year = parseInt(dateParts[2], 10);
          return { date, count, sortDate: new Date(year, month, day) };
        }
        return { date, count, sortDate: new Date(0) }; // Fallback for invalid dates
      })
      .sort((a, b) => a.sortDate - b.sortDate)
      .slice(-30); // Get only the last 30 days for readability
    
    // Calculate most common words
    const wordCounts = {};
    data.forEach(row => {
      if (!row.message) return;
      
      const words = row.message
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove non-alphanumeric characters but keep Unicode letters
        .split(/\s+/)
        .filter(word => word.length > 2); // Filter out short words
      
      words.forEach(word => {
        if (!wordCounts[word]) {
          wordCounts[word] = 0;
        }
        wordCounts[word]++;
      });
    });
    
    // Get top 30 words
    const topWords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word, count]) => ({ word, count }));
    
    // Calculate most common phrases (2-3 words)
    const phraseCounts = {};
    data.forEach(row => {
      if (!row.message) return;
      
      const words = row.message
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .split(/\s+/)
        .filter(word => word.length > 1);
      
      // Generate 2-word phrases
      for (let i = 0; i < words.length - 1; i++) {
        const phrase = `${words[i]} ${words[i + 1]}`;
        if (!phraseCounts[phrase]) {
          phraseCounts[phrase] = 0;
        }
        phraseCounts[phrase]++;
      }
      
      // Generate 3-word phrases
      for (let i = 0; i < words.length - 2; i++) {
        const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        if (!phraseCounts[phrase]) {
          phraseCounts[phrase] = 0;
        }
        phraseCounts[phrase]++;
      }
    });
    
    // Get top 30 phrases with at least 3 occurrences
    const topPhrases = Object.entries(phraseCounts)
      .filter(([phrase, count]) => count >= 3) // Filter out phrases that occur less than 3 times
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([phrase, count]) => ({ phrase, count }));
    
    // Format data for charts
    const timelineData = Object.entries(messagesByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
    
    const weekdayData = Object.entries(avgMessagesByWeekday)
      .map(([day, avg]) => ({ 
        day, 
        avg: parseFloat(avg.toFixed(1))
      }));
    
    const hourData = messagesByHour
      .map((count, hour) => ({ hour: `${hour}:00`, count }));
    
    const senderData = uniqueSenders.map(sender => ({
      name: sender,
      messages: messageCountBySender[sender],
      words: wordCountBySender[sender]
    }));
    
    // Set all stats
    setStats({
      timelineData,
      dailyTimelineData,
      weekdayData,
      hourData,
      senderData,
      topWords,
      topPhrases,
      mostActiveDay: {
        date: mostActiveDay[0],
        count: mostActiveDay[1]
      }
    });
  };


  // Filter chat data by search term
  const filteredChatData = searchTerm && chatData.length > 0
    ? chatData.filter(msg => 
        msg.message && msg.message.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : chatData;


  // Group messages by date for the chat UI
  const groupedByDate = _.groupBy(filteredChatData, 'date');


  const scrollToBottom = () => {
    if (activeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };


  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#EA4335', '#34A853', '#FBBC05', '#4285F4'];


  const handleDragOver = (e) => {
    e.preventDefault();
  };


  const handleDrop = (e) => {
    e.preventDefault();
    
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        if (e.dataTransfer.items[i].kind === 'file') {
          const file = e.dataTransfer.items[i].getAsFile();
          if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            // Manually set the file in the input element to trigger the change event
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInputRef.current.files = dataTransfer.files;
            
            // Trigger the file upload handler
            handleFileUpload({ target: { files: [file] } });
            break;
          } else {
            setError('Please upload a CSV file.');
          }
        }
      }
    }
  };


  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-green-600 text-white p-4">
        <h1 className="text-2xl font-bold">WhatsApp Chat Analyzer</h1>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex bg-white border-b">
        <button 
          onClick={() => setActiveTab('upload')}
          className={`px-6 py-3 font-medium ${activeTab === 'upload' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-600'}`}
        >
          Upload
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`px-6 py-3 font-medium ${activeTab === 'chat' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-600'} ${!fileUploaded ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!fileUploaded}
        >
          Chat
        </button>
        <button 
          onClick={() => setActiveTab('statistics')}
          className={`px-6 py-3 font-medium ${activeTab === 'statistics' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-600'} ${!fileUploaded ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!fileUploaded}
        >
          Statistics
        </button>
      </div>
      
      <div className="flex-1 overflow-auto">
        {activeTab === 'upload' && (
          <div className="p-8 flex flex-col items-center justify-center h-full">
            <div 
              className="border-4 border-dashed border-gray-300 rounded-lg p-12 w-full max-w-2xl text-center"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              
              <h2 className="text-xl font-medium mb-4">Upload WhatsApp Chat CSV</h2>
              <p className="text-gray-500 mb-6">Drag and drop your WhatsApp chat CSV file here, or click to select a file</p>
              
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="hidden"
                id="file-upload"
              />
              
              <label htmlFor="file-upload" className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg cursor-pointer">
                Select CSV File
              </label>
              
              <div className="mt-4 text-sm">
                <p>Your file should have these columns:</p>
                <p className="font-mono text-gray-600 mt-1">datetime, date, time, hour, weekday, sender, message</p>
              </div>
              
              {error && (
                <div className="mt-4 text-red-600 p-2 bg-red-50 rounded">
                  {error}
                </div>
              )}
              
              {loading && (
                <div className="mt-6 flex items-center justify-center">
                  <svg className="animate-spin h-6 w-6 text-green-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Processing...</span>
                </div>
              )}
            </div>
          </div>
        )}
      
        {activeTab === 'chat' && fileUploaded && (
          <div className="flex flex-col h-full">
            {/* Search Bar */}
            <div className="p-4 bg-white border-b sticky top-0 z-10">
              <input
                type="text"
                placeholder="Search in chat..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            {/* Chat Messages */}
            <div className="flex-1 p-4 bg-gray-100 overflow-auto">
              {Object.keys(groupedByDate).length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No messages found</p>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto">
                  {Object.entries(groupedByDate).map(([date, messages]) => (
                    <div key={date} className="mb-4">
                      {/* Date Divider */}
                      <div className="flex justify-center my-4">
                        <div className="bg-white rounded-lg px-4 py-2 shadow text-sm text-gray-600">
                          {date}
                        </div>
                      </div>
                      
                      {/* Messages for this date */}
                      {messages.map((msg, idx) => {
                        // Get the first sender from the chat to align messages
                        const firstSender = chatData.length > 0 ? chatData[0].sender : '';
                        const isSentByMe = msg.sender !== firstSender;
                        
                        return (
                          <div 
                            key={`${date}-${idx}`} 
                            className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} mb-2`}
                          >
                            <div 
                              className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 shadow ${
                                isSentByMe ? 'bg-green-500 text-white' : 'bg-white text-black'
                              }`}
                            >
                              <div className="font-bold text-sm">{msg.sender}</div>
                              <div className="whitespace-pre-wrap">{msg.message}</div>
                              <div className="text-xs text-right mt-1 opacity-70">
                                {msg.time ? msg.time.split(':').slice(0, 2).join(':') : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'statistics' && fileUploaded && stats && (
          <div className="p-6">
            <div className="max-w-6xl mx-auto space-y-8">
              <h2 className="text-2xl font-bold mb-6">Chat Statistics</h2>
              
              {/* Most Active Day */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold mb-4">Most Active Day</h3>
                <p className="text-lg">
                  <span className="font-bold">{stats.mostActiveDay.date}</span> with{' '}
                  <span className="font-bold text-green-600">{stats.mostActiveDay.count}</span> messages
                </p>
              </div>
              
              {/* Monthly Timeline Chart */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold mb-4">Monthly Message Timeline</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.timelineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#25D366" name="Messages" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Daily Timeline Chart */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold mb-4">Daily Message Timeline (Last 30 Days)</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.dailyTimelineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#34B7F1" name="Messages" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Average Messages by Weekday */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold mb-4">Average Messages by Day of Week</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.weekdayData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="avg" fill="#25D366" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Messages by Hour */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold mb-4">Messages by Hour of Day</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.hourData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#128C7E" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Who Sends More Messages */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold mb-4">Who Sends More Messages?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-medium mb-2">Total Messages</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.senderData}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="messages"
                          >
                            {stats.senderData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4">
                      {stats.senderData.map((sender, index) => (
                        <div key={sender.name} className="flex items-center mb-2">
                          <div className="w-4 h-4 mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <span>{sender.name}: {sender.messages} messages</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium mb-2">Total Words</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.senderData}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="words"
                          >
                            {stats.senderData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4">
                      {stats.senderData.map((sender, index) => (
                        <div key={sender.name} className="flex items-center mb-2">
                          <div className="w-4 h-4 mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                          <span>{sender.name}: {sender.words} words</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Most Common Words */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold mb-4">Most Common Words</h3>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={stats.topWords} 
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis 
                        type="category" 
                        dataKey="word" 
                        tick={{ fontSize: 12 }}
                        width={80}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#075E54" name="Occurrences" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Most Common Phrases */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold mb-4">Most Common Phrases</h3>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={stats.topPhrases} 
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis 
                        type="category" 
                        dataKey="phrase" 
                        tick={{ fontSize: 12 }}
                        width={120}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#128C7E" name="Occurrences" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {!fileUploaded && (activeTab === 'chat' || activeTab === 'statistics') && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-xl font-medium mb-2">No Data Available</h2>
              <p className="text-gray-500">Please upload a WhatsApp chat CSV file first.</p>
              <button 
                onClick={() => setActiveTab('upload')} 
                className="mt-4 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
              >
                Go to Upload
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


export default WhatsAppAnalyzer;