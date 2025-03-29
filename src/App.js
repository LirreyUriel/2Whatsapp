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

  // File upload handler
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

  // Calculate statistics from chat data
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
    
    // Timeline data (by day)
    const dailyTimelineData = Object.entries(messagesByDate)
      .map(([date, count]) => {
        const dateParts = date.split('/');
        if (dateParts.length === 3) {
          const day = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1;
          const year = parseInt(dateParts[2], 10);
          return { date, count, sortDate: new Date(year, month, day) };
        }
        return { date, count, sortDate: new Date(0) };
      })
      .sort((a, b) => a.sortDate - b.sortDate)
      .slice(-30); // Last 30 days
    
    // Calculate word frequencies
    const wordCounts = {};
    data.forEach(row => {
      if (!row.message) return;
      
      const words = row.message
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .split(/\s+/)
        .filter(word => word.length > 2);
      
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
    
    // Calculate most common phrases
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
    
    // Get top 30 phrases
    const topPhrases = Object.entries(phraseCounts)
      .filter(([phrase, count]) => count >= 3)
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
    
    // Set all statistics
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
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInputRef.current.files = dataTransfer.files;
            
            handleFileUpload({ target: { files: [file] } });
            break;
          } else {
            setError('Please upload a CSV file.');
          }
        }
      }
    }
  };

  // Custom styles for WhatsApp-like UI
  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      fontFamily: 'Helvetica, Arial, sans-serif',
    },
    header: {
      backgroundColor: '#075E54',
      color: 'white',
      padding: '15px',
      textAlign: 'center',
    },
    tabs: {
      display: 'flex',
      backgroundColor: 'white',
      borderBottom: '1px solid #ddd',
    },
    tab: {
      padding: '10px 20px',
      cursor: 'pointer',
      borderBottom: '2px solid transparent',
      fontWeight: 500,
    },
    activeTab: {
      color: '#25D366',
      borderBottom: '2px solid #25D366',
    },
    disabledTab: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    contentArea: {
      flex: 1,
      overflow: 'auto',
    },
    uploadArea: {
      padding: '30px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
    },
    dropZone: {
      border: '3px dashed #ccc',
      borderRadius: '10px',
      padding: '40px',
      width: '100%',
      maxWidth: '500px',
      textAlign: 'center',
    },
    uploadIcon: {
      fontSize: '48px',
      color: '#ccc',
      marginBottom: '20px',
    },
    uploadButton: {
      backgroundColor: '#25D366',
      color: 'white',
      border: 'none',
      padding: '10px 20px',
      borderRadius: '5px',
      cursor: 'pointer',
      fontWeight: 'bold',
      marginTop: '20px',
    },
    error: {
      color: 'red',
      marginTop: '15px',
      padding: '10px',
      backgroundColor: '#ffeeee',
      borderRadius: '5px',
    },
    loading: {
      marginTop: '20px',
      display: 'flex',
      alignItems: 'center',
    },
    chatHeader: {
      backgroundColor: '#EDEDED',
      padding: '10px',
      display: 'flex',
      alignItems: 'center',
    },
    chatAvatar: {
      width: '40px',
      height: '40px',
      backgroundColor: '#DDD',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: '15px',
      fontWeight: 'bold',
    },
    chatInfo: {
      flex: 1,
    },
    searchBar: {
      backgroundColor: '#F6F6F6',
      padding: '10px',
    },
    searchInput: {
      width: '100%',
      padding: '8px',
      borderRadius: '20px',
      border: '1px solid #ddd',
    },
    chatBackground: {
      backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AMIFCg3kA2L3AAAAhNJREFUeNrtnE1rGlEUhh+nFaShIAiBdFMIXbfQXfMH8mM7m+6qTRZFIgEhIAQCQcjELLpTSUCaNJvJKpM6E+fzLnTPgy5EhXvPfTzM1XEEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOzS8NnA9K1RZJ8pUsrHuXBs2vgEQqcQsVYqRazjCOI6VeW6qmIY8aCIEFIhfkRr5b6qXo35pIyU8oNX5PZp3bNx3hSSqCoiHu2MlPJ0JepXRMKoDzvAK3KK3KeGHQcefCIeQ5dDFNKJXLK2mm1ycJlzhPQGSbzIJRNBh6aRvKM8iLtODPhtP75EwuMrJD0y0TUhpSBiKcyQlYZBX/Ah8iCS3iNkW9dF2DQM+n58ie1ySO81k10I2WOciBrIQIQIISJECBEihAgRQoQIIUKEECFCiBAiRMihhVjZ+VWECCFChBAhQogQIvS+qvLpF5tSNyGlvN0ckxukbVy6QqzTm9/HdnL6lXV5OdVWObBMFjsYI2Q9TFuX8e7m90NdTmLPvO99ktpTl3O5bMI4YyHtIGBZhI7U5Tyf/nZ7eRyH/LNl8TxuA5dXrxQ6Csv5aMeP2zIUYqPbX5Ps4Jm1+E13vLMsJ+NVOx0h7eCaxXx6JGKfhSHLAA8kl+1A5FjcHjv45MHXPy0LAgYiKyGEmQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+Jf8A2LM+/L2GftRAAAAAElFTkSuQmCC")',
      backgroundColor: '#E5DDD5',
      flex: 1,
      padding: '20px',
      overflow: 'auto',
    },
    dateLabel: {
      display: 'flex',
      justifyContent: 'center',
      margin: '15px 0',
    },
    datePill: {
      backgroundColor: '#E1F2FB',
      color: '#4A4A4A',
      padding: '5px 12px',
      borderRadius: '8px',
      fontSize: '12px',
      boxShadow: '0 1px 0.5px rgba(0,0,0,.13)',
    },
    messageRow: {
      display: 'flex',
      marginBottom: '10px',
    },
    messageRowOutgoing: {
      justifyContent: 'flex-end',
    },
    messageRowIncoming: {
      justifyContent: 'flex-start',
    },
    messageBubble: {
      maxWidth: '65%',
      padding: '8px 12px',
      borderRadius: '7.5px',
      position: 'relative',
      boxShadow: '0 1px 0.5px rgba(0,0,0,.13)',
    },
    outgoingBubble: {
      backgroundColor: '#DCF8C6',
    },
    incomingBubble: {
      backgroundColor: '#FFFFFF',
    },
    senderName: {
      fontWeight: 'bold',
      fontSize: '13px',
      marginBottom: '4px',
      color: '#075E54',
    },
    messageText: {
      fontSize: '14px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    },
    messageTime: {
      fontSize: '11px',
      color: '#999',
      textAlign: 'right',
      marginTop: '2px',
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    readTicks: {
      marginLeft: '4px',
    },
    statsContainer: {
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
    },
    statCard: {
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 2px 4px rgba(0,0,0,.1)',
      marginBottom: '30px',
    },
    statTitle: {
      fontSize: '20px',
      fontWeight: 'bold',
      marginBottom: '15px',
      color: '#075E54',
    },
    chartContainer: {
      height: '300px',
      width: '100%',
    },
    noDataContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      textAlign: 'center',
    },
    noDataIcon: {
      fontSize: '48px',
      color: '#ccc',
      marginBottom: '20px',
    }
  };

  // Combine styles for conditional rendering
  const getTabStyle = (tabName) => {
    if (activeTab === tabName) {
      return { ...styles.tab, ...styles.activeTab };
    }
    if ((tabName === 'chat' || tabName === 'statistics') && !fileUploaded) {
      return { ...styles.tab, ...styles.disabledTab };
    }
    return styles.tab;
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1>WhatsApp Chat Analyzer</h1>
      </div>
      
      {/* Tab Navigation */}
      <div style={styles.tabs}>
        <div 
          style={getTabStyle('upload')}
          onClick={() => setActiveTab('upload')}
        >
          Upload
        </div>
        <div 
          style={getTabStyle('chat')}
          onClick={() => fileUploaded ? setActiveTab('chat') : null}
        >
          Chat
        </div>
        <div 
          style={getTabStyle('statistics')}
          onClick={() => fileUploaded ? setActiveTab('statistics') : null}
        >
          Statistics
        </div>
      </div>
      
      <div style={styles.contentArea}>
        {activeTab === 'upload' && (
          <div style={styles.uploadArea}>
            <div 
              style={styles.dropZone}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div style={styles.uploadIcon}>↑</div>
              
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
              
              <label htmlFor="file-upload" style={styles.uploadButton}>
                Select CSV File
              </label>
              
              <div style={{ marginTop: '15px', fontSize: '14px' }}>
                <p>Your file should have these columns:</p>
                <p style={{ fontFamily: 'monospace', color: '#666' }}>datetime, date, time, hour, weekday, sender, message</p>
              </div>
              
              {error && (
                <div style={styles.error}>
                  {error}
                </div>
              )}
              
              {loading && (
                <div style={styles.loading}>
                  <span style={{ marginRight: '10px' }}>Processing...</span>
                </div>
              )}
            </div>
          </div>
        )}
      
        {activeTab === 'chat' && fileUploaded && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* WhatsApp Header */}
            <div style={styles.chatHeader}>
              <div style={styles.chatAvatar}>
                WA
              </div>
              <div style={styles.chatInfo}>
                <div style={{ fontWeight: 'bold' }}>
                  {chatData.length > 0 ? 
                    `${_.uniq(chatData.map(msg => msg.sender)).join(', ')}` : 
                    'WhatsApp Chat'
                  }
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {chatData.length} messages, {_.uniq(chatData.map(msg => msg.sender)).length} participants
                </div>
              </div>
            </div>
            
            {/* Search Bar */}
            <div style={styles.searchBar}>
              <input
                type="text"
                placeholder="Search in chat..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            
            {/* Chat Messages */}
            <div style={styles.chatBackground}>
              {Object.keys(groupedByDate).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <p>No messages found</p>
                </div>
              ) : (
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                  {Object.entries(groupedByDate).map(([date, messages]) => (
                    <div key={date}>
                      {/* Date Divider */}
                      <div style={styles.dateLabel}>
                        <div style={styles.datePill}>
                          {date}
                        </div>
                      </div>
                      
                      {/* Messages for this date */}
                      {messages.map((msg, idx) => {
                        // Get the first sender to determine message direction
                        const userIsSender = msg.sender === chatData[0]?.sender;
                        
                        return (
                          <div 
                            key={`${date}-${idx}`} 
                            style={{
                              ...styles.messageRow,
                              ...(userIsSender ? styles.messageRowOutgoing : styles.messageRowIncoming)
                            }}
                          >
                            <div 
                              style={{
                                ...styles.messageBubble,
                                ...(userIsSender ? styles.outgoingBubble : styles.incomingBubble)
                              }}
                            >
                              {!userIsSender && (
                                <div style={styles.senderName}>
                                  {msg.sender}
                                </div>
                              )}
                              
                              <div style={styles.messageText}>
                                {msg.message}
                              </div>
                              
                              <div style={styles.messageTime}>
                                {msg.time ? msg.time.split(':').slice(0, 2).join(':') : ''}
                                
                                {userIsSender && (
                                  <span style={styles.readTicks}>✓✓</span>
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
          <div style={styles.statsContainer}>
            <h2 style={{ marginBottom: '20px', fontSize: '24px' }}>Chat Statistics</h2>
            
            {/* Most Active Day */}
            <div style={styles.statCard}>
              <div style={styles.statTitle}>Most Active Day</div>
              <p style={{ fontSize: '18px' }}>
                <span style={{ fontWeight: 'bold' }}>{stats.mostActiveDay.date}</span> with{' '}
                <span style={{ fontWeight: 'bold', color: '#25D366' }}>{stats.mostActiveDay.count}</span> messages
              </p>
            </div>
            
            {/* Monthly Timeline Chart */}
            <div style={styles.statCard}>
              <div style={styles.statTitle}>Monthly Message Timeline</div>
              <div style={styles.chartContainer}>
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
            <div style={styles.statCard}>
              <div style={styles.statTitle}>Daily Message Timeline (Last 30 Days)</div>
              <div style={styles.chartContainer}>
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
            <div style={styles.statCard}>
              <div style={styles.statTitle}>Average Messages by Day of Week</div>
              <div style={styles.chartContainer}>
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
            <div style={styles.statCard}>
              <div style={styles.statTitle}>Messages by Hour of Day</div>
              <div style={styles.chartContainer}>
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
            <div style={styles.statCard}>
              <div style={styles.statTitle}>Who Sends More Messages?</div>
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
            <div style={styles.statCard}>
              <div style={styles.statTitle}>Most Common Words</div>
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
            <div style={styles.statCard}>
              <div style={styles.statTitle}>Most Common Phrases</div>
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
          <div style={styles.noDataContainer}>
            <div style={{ padding: '30px', textAlign: 'center' }}>
              <div style={styles.noDataIcon}>⚠️</div>
              <h2>No Data Available</h2>
              <p style={{ color: '#666', marginBottom: '20px' }}>Please upload a WhatsApp chat CSV file first.</p>
              <button 
                onClick={() => setActiveTab('upload')} 
                style={styles.uploadButton}
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
