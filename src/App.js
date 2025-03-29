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

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [activeTab, filteredChatData]);

  const COLORS = ['#25D366', '#128C7E', '#075E54', '#34B7F1', '#FF5252', '#448AFF', '#7C4DFF', '#FFD740'];

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
    <div>
      {/* Simple CSS for WhatsApp-like styling */}
      <style>
        {`
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f0f0f0; }
          .container { max-width: 100%; margin: 0 auto; }
          .header { background-color: #075E54; color: white; padding: 20px; text-align: center; }
          .tabs { display: flex; background-color: white; border-bottom: 1px solid #ddd; }
          .tab { padding: 15px 20px; cursor: pointer; font-weight: bold; }
          .tab.active { color: #25D366; border-bottom: 3px solid #25D366; }
          .tab.disabled { opacity: 0.5; cursor: not-allowed; }
          .content { padding: 20px; }
          
          /* Upload area */
          .upload-area { display: flex; justify-content: center; align-items: center; min-height: 60vh; }
          .drop-zone { border: 3px dashed #ccc; border-radius: 10px; padding: 30px; width: 100%; max-width: 500px; text-align: center; }
          .upload-btn { background-color: #25D366; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; margin-top: 20px; }
          .error-msg { color: red; margin-top: 15px; padding: 10px; background-color: #ffeeee; border-radius: 5px; }
          
          /* WhatsApp chat styling */
          .chat-container { display: flex; flex-direction: column; height: 80vh; }
          .chat-header { background-color: #ededed; padding: 10px 16px; display: flex; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .chat-avatar { width: 40px; height: 40px; background-color: #ddd; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-weight: bold; }
          .chat-title { font-weight: bold; }
          .chat-subtitle { font-size: 13px; color: #555; }
          .search-bar { padding: 10px; background-color: #f6f6f6; }
          .search-input { width: 100%; padding: 8px 12px; border-radius: 20px; border: 1px solid #ddd; outline: none; }
          
          .chat-messages { flex: 1; padding: 10px; background-color: #e5ddd5; background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AMIFCg3kA2L3AAAAhNJREFUeNrtnE1rGlEUhh+nFaShIAiBdFMIXbfQXfMH8mM7m+6qTRZFIgEhIAQCQcjELLpTSUCaNJvJKpM6E+fzLnTPgy5EhXvPfTzM1XEEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOzS8NnA9K1RZJ8pUsrHuXBs2vgEQqcQsVYqRazjCOI6VeW6qmIY8aCIEFIhfkRr5b6qXo35pIyU8oNX5PZp3bNx3hSSqCoiHu2MlPJ0JepXRMKoDzvAK3KK3KeGHQcefCIeQ5dDFNKJXLK2mm1ycJlzhPQGSbzIJRNBh6aRvKM8iLtODPhtP75EwuMrJD0y0TUhpSBiKcyQlYZBX/Ah8iCS3iNkW9dF2DQM+n58ie1ySO81k10I2WOciBrIQIQIISJECBEihAgRQoQIIUKEECFCiBAiRMihhVjZ+VWECCFChBAhQogQIvS+qvLpF5tSNyGlvN0ckxukbVy6QqzTm9/HdnL6lXV5OdVWObBMFjsYI2Q9TFuX8e7m90NdTmLPvO99ktpTl3O5bMI4YyHtIGBZhI7U5Tyf/nZ7eRyH/LNl8TxuA5dXrxQ6Csv5aMeP2zIUYqPbX5Ps4Jm1+E13vLMsJ+NVOx0h7eCaxXx6JGKfhSHLAA8kl+1A5FjcHjv45MHXPy0LAgYiKyGEmQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+Jf8A2LM+/L2GftRAAAAAElFTkSuQmCC'); overflow-y: auto; }
          
          .date-divider { display: flex; justify-content: center; margin: 10px 0; }
          .date-label { background-color: #e1f2fb; color: #4A4A4A; padding: 5px 10px; border-radius: 7px; font-size: 12px; box-shadow: 0 1px 0.5px rgba(0,0,0,.13); }
          
          .message-row { display: flex; margin-bottom: 2px; }
          .message-row.outgoing { justify-content: flex-end; }
          .message-bubble { max-width: 65%; padding: 6px 7px 8px 9px; border-radius: 7.5px; position: relative; box-shadow: 0 1px 0.5px rgba(0,0,0,.13); }
          .message-bubble.outgoing { background-color: #dcf8c6; margin-left: 50px; }
          .message-bubble.incoming { background-color: white; margin-right: 50px; }
          .sender-name { font-weight: bold; font-size: 13px; margin-bottom: 4px; color: #075E54; }
          .message-text { font-size: 14px; white-space: pre-wrap; word-break: break-word; }
          .message-time { font-size: 11px; color: rgba(0,0,0,.45); text-align: right; margin-top: 2px; margin-left: 4px; display: flex; justify-content: flex-end; align-items: center; }
          
          /* Statistics styling */
          .stats-container { padding: 20px; max-width: 1200px; margin: 0 auto; }
          .stat-card { background-color: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,.1); margin-bottom: 30px; }
          .stat-title { font-size: 20px; font-weight: bold; margin-bottom: 15px; color: #075E54; }
          .chart-container { height: 300px; width: 100%; }
          
          /* Responsive fixes */
          @media (max-width: 768px) {
            .message-bubble { max-width: 80%; }
          }
        `}
      </style>

      <div className="container">
        {/* Header */}
        <div className="header">
          <h1>WhatsApp Chat Analyzer</h1>
        </div>
        
        {/* Tab Navigation */}
        <div className="tabs">
          <div 
            className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Upload
          </div>
          <div 
            className={`tab ${activeTab === 'chat' ? 'active' : ''} ${!fileUploaded ? 'disabled' : ''}`}
            onClick={() => fileUploaded ? setActiveTab('chat') : null}
          >
            Chat
          </div>
          <div 
            className={`tab ${activeTab === 'statistics' ? 'active' : ''} ${!fileUploaded ? 'disabled' : ''}`}
            onClick={() => fileUploaded ? setActiveTab('statistics') : null}
          >
            Statistics
          </div>
        </div>
        
        <div className="content">
          {activeTab === 'upload' && (
            <div className="upload-area">
              <div 
                className="drop-zone"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <h2>Upload WhatsApp Chat CSV</h2>
                <p>Drag and drop your WhatsApp chat CSV file here, or click to select a file</p>
                
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  id="file-upload"
                />
                
                <label htmlFor="file-upload" className="upload-btn">
                  Select CSV File
                </label>
                
                <div style={{ marginTop: '15px', fontSize: '14px' }}>
                  <p>Your file should have these columns:</p>
                  <p style={{ fontFamily: 'monospace', color: '#666' }}>datetime, date, time, hour, weekday, sender, message</p>
                </div>
                
                {error && (
                  <div className="error-msg">
                    {error}
                  </div>
                )}
                
                {loading && (
                  <div style={{ marginTop: '20px' }}>
                    <p>Processing...</p>
                  </div>
                )}
              </div>
            </div>
          )}
        
          {activeTab === 'chat' && fileUploaded && (
            <div className="chat-container">
              {/* WhatsApp Header */}
              <div className="chat-header">
                <div className="chat-avatar">
                  WA
                </div>
                <div>
                  <div className="chat-title">
                    {chatData.length > 0 ? 
                      `${_.uniq(chatData.map(msg => msg.sender)).join(', ')}` : 
                      'WhatsApp Chat'
                    }
                  </div>
                  <div className="chat-subtitle">
                    {chatData.length} messages, {_.uniq(chatData.map(msg => msg.sender)).length} participants
                  </div>
                </div>
              </div>
              
              {/* Search Bar */}
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Search in chat..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              
              {/* Chat Messages */}
              <div className="chat-messages">
                {Object.keys(groupedByDate).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <p>No messages found</p>
                  </div>
                ) : (
                  <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    {Object.entries(groupedByDate).map(([date, messages]) => (
                      <div key={date}>
                        {/* Date Divider */}
                        <div className="date-divider">
                          <div className="date-label">
                            {date}
                          </div>
                        </div>
                        
                        {/* Messages for this date */}
                        {messages.map((msg, idx) => {
                          // Determine if message is sent by the user or received
                          const isOutgoing = msg.sender === chatData[0]?.sender;
                          
                          return (
                            <div 
                              key={`${date}-${idx}`} 
                              className={`message-row ${isOutgoing ? 'outgoing' : 'incoming'}`}
                            >
                              <div 
                                className={`message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`}
                              >
                                {!isOutgoing && (
                                  <div className="sender-name">
                                    {msg.sender}
                                  </div>
                                )}
                                
                                <div className="message-text">
                                  {msg.message}
                                </div>
                                
                                <div className="message-time">
                                  {msg.time ? msg.time.split(':').slice(0, 2).join(':') : ''}
                                  
                                  {isOutgoing && (
                                    <span style={{ marginLeft: '4px' }}>✓✓</span>
                                  )}
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
            <div className="stats-container">
              <h2 style={{ marginBottom: '20px', fontSize: '24px' }}>Chat Statistics</h2>
              
              {/* Most Active Day */}
              <div className="stat-card">
                <div className="stat-title">Most Active Day</div>
                <p style={{ fontSize: '18px' }}>
                  <span style={{ fontWeight: 'bold' }}>{stats.mostActiveDay.date}</span> with{' '}
                  <span style={{ fontWeight: 'bold', color: '#25D366' }}>{stats.mostActiveDay.count}</span> messages
                </p>
              </div>
              
              {/* Monthly Timeline Chart */}
              <div className="stat-card">
                <div className="stat-title">Monthly Message Timeline</div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.timelineData}>
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
              <div className="stat-card">
                <div className="stat-title">Average Messages by Day of Week</div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.weekdayData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="avg" fill="#25D366" name="Average Messages" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Messages by Hour */}
              <div className="stat-card">
                <div className="stat-title">Messages by Hour of Day</div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.hourData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#128C7E" name="Messages" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Who Sends More Messages */}
              <div className="stat-card">
                <div className="stat-title">Who Sends More Messages?</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>Total Messages</h4>
                    <div style={{ height: '300px' }}>
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
                    <div style={{ marginTop: '20px' }}>
                      {stats.senderData.map((sender, index) => (
                        <div key={sender.name} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            backgroundColor: COLORS[index % COLORS.length],
                            marginRight: '8px' 
                          }}></div>
                          <span>{sender.name}: {sender.messages} messages</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px' }}>Total Words</h4>
                    <div style={{ height: '300px' }}>
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
                    <div style={{ marginTop: '20px' }}>
                      {stats.senderData.map((sender, index) => (
                        <div key={sender.name} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            backgroundColor: COLORS[index % COLORS.length],
                            marginRight: '8px' 
                          }}></div>
                          <span>{sender.name}: {sender.words} words</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Most Common Words */}
              <div className="stat-card">
                <div className="stat-title">Most Common Words</div>
                <div style={{ height: '400px' }}>
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
              <div className="stat-card">
                <div className="stat-title">Most Common Phrases</div>
                <div style={{ height: '400px' }}>
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
          )}
          
          {!fileUploaded && (activeTab === 'chat' || activeTab === 'statistics') && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
              <div style={{ textAlign: 'center', padding: '30px' }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
                <h2>No Data Available</h2>
                <p style={{ color: '#666', marginBottom: '20px' }}>Please upload a WhatsApp chat CSV file first.</p>
                <button 
                  onClick={() => setActiveTab('upload')} 
                  className="upload-btn"
                >
                  Go to Upload
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppAnalyzer;Axis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#25D366" name="Messages" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Daily Timeline Chart */}
              <div className="stat-card">
                <div className="stat-title">Daily Message Timeline (Last 30 Days)</div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.dailyTimelineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <X
