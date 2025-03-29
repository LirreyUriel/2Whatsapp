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

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // Get color for avatar based on name
  const getAvatarColor = (name) => {
    if (!name) return '#cccccc';
    
    // Simple hash function to generate consistent colors
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      '#25D366', // WhatsApp green
      '#128C7E', // WhatsApp teal
      '#075E54', // WhatsApp dark green
      '#34B7F1', // WhatsApp blue
      '#FF5252', // Red
      '#448AFF', // Blue
      '#7C4DFF', // Purple
      '#FFD740', // Amber
      '#FF6E40', // Deep Orange
      '#69F0AE', // Light Green
    ];
    
    return colors[Math.abs(hash) % colors.length];
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [activeTab, filteredChatData]);

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
            {/* WhatsApp-style header */}
            <div className="bg-green-600 text-white p-3 shadow-md flex items-center sticky top-0 z-10">
              <div className="flex items-center">
                {chatData.length > 0 && (
                  <div className="flex items-center">
                    {/* Chat image/avatar */}
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mr-3 text-green-600 font-bold">
                      <span>WA</span>
                    </div>
                    
                    {/* Chat info */}
                    <div>
                      <h3 className="font-bold text-sm">{chatData.length > 0 ? 
                        `${_.uniq(chatData.map(msg => msg.sender)).join(', ')}` : 
                        'WhatsApp Chat'}
                      </h3>
                      <p className="text-xs opacity-90">
                        {chatData.length} messages, {_.uniq(chatData.map(msg => msg.sender)).length} participants
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Search */}
              <div className="ml-auto flex items-center">
                <input
                  type="text"
                  placeholder="Search in chat..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="p-2 rounded-lg text-black text-sm w-48 md:w-64 focus:outline-none focus:ring-2 focus:ring-white"
                />
              </div>
            </div>
            
            {/* WhatsApp-style chat background */}
            <div className="flex-1 bg-[#e5ddd5] bg-opacity-80 overflow-auto" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23d1cbbd' fill-opacity='0.2' fill-rule='evenodd'/%3E%3C/svg%3E")`,
            }}>
              {Object.keys(groupedByDate).length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="bg-white p-6 rounded-lg shadow-md text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-gray-500">No messages found</p>
                  </div>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto py-6 px-4">
                  {Object.entries(groupedByDate).map(([date, messages]) => (
                    <div key={date} className="mb-8">
                      {/* Date Divider */}
                      <div className="flex justify-center my-4">
                        <div className="bg-gray-200 rounded-lg px-4 py-1 shadow-sm text-xs text-gray-600 font-medium">
                          {date}
                        </div>
                      </div>
                      
                      {/* Messages for this date */}
                      {messages.map((msg, idx) => {
                        // Get the first sender from the chat to align messages
                        const firstSender = chatData[0]?.sender;
                        const isSentByMe = msg.sender !== firstSender;
                        
                        // Check if different sender than previous message
                        const isNewSender = idx === 0 || messages[idx - 1].sender !== msg.sender;
                        
                        // Check if more than 2 minutes from previous message
                        const isTimeGap = idx === 0 || 
                          (new Date(parseDate(msg.date, msg.time)) - 
                           new Date(parseDate(messages[idx - 1].date, messages[idx - 1].time))) > 2 * 60 * 1000;
                        
                        // Show name for first message in a sequence
                        const showName = isNewSender || isTimeGap;
                        
                        return (
                          <div 
                            key={`${date}-${idx}`} 
                            className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} mb-1`}
                          >
                            <div className={`flex ${!isSentByMe && 'flex-row-reverse'}`}>
                              {/* Avatar - show only for first message in a sequence */}
                              {(showName && !isSentByMe) && (
                                <div className="flex items-start mt-2 mr-2">
                                  <div 
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                    style={{backgroundColor: getAvatarColor(msg.sender)}}
                                  >
                                    {getInitials(msg.sender)}
                                  </div>
                                </div>
                              )}
                              
                              <div 
                                className={`max-w-xs relative rounded-lg px-3 py-2 shadow ${
                                  isSentByMe 
                                    ? 'bg-[#dcf8c6] ml-6' 
                                    : 'bg-white mr-6'
                                }`}
                              >
                                {/* Message tail */}
                                <div 
                                  className={`absolute top-0 w-3 h-3 ${
                                    isSentByMe 
                                      ? 'bg-[#dcf8c6] -left-1 transform rotate-45' 
                                      : 'bg-white -right-1 transform rotate-45'
                                  }`}
                                  style={{display: showName ? 'block' : 'none'}}
                                ></div>
                                
                                {/* Sender name */}
                                {showName && !isSentByMe && (
                                  <div className="font-bold text-xs" style={{color: getAvatarColor(msg.sender)}}>
                                    {msg.sender}
                                  </div>
                                )}
                                
                                {/* Message content */}
                                <div className="text-sm whitespace-pre-wrap break-words">
                                  {msg.message}
                                </div>
                                
                                {/* Message time */}
                                <div className="text-[10px] text-right mt-1 text-gray-500 flex items-center justify-end">
                                  {msg.time ? msg.time.split(':').slice(0, 2).join(':') : ''}
                                  {isSentByMe && (
                                    <svg className="w-3 h-3 ml-1 text-gray-500" viewBox="0 0 16 16" fill="currentColor">
                                      <path d="M8.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L2.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093L8.95 4.992a.252.252 0 0 1 .02-.022z" />
                                      <path d="M12.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L6.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 2.973-3.712z" />
                                    </svg>
                                  )}
                                </div>
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
