import { useState, useRef, useEffect } from 'react'

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:8000/routing/route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: userMessage }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Add assistant message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.output,
        model: data.model,
        metadata: data.metadata
      }])
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error.message}. Make sure the FastAPI backend is running at http://localhost:8000`,
        model: 'error',
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 px-4 py-5 shadow-lg backdrop-blur-sm">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 text-center">
          Restruct Router Test Console
        </h1>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-16 animate-fade-in">
              <div className="mb-4">
                <div className="inline-block p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full">
                  <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
              </div>
              <p className="text-xl font-semibold text-gray-300 mb-2">Welcome to Restruct Router</p>
              <p className="text-sm text-gray-500">Send a message to test the LLM routing endpoint</p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-in`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-lg transition-all duration-200 hover:shadow-xl ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                    : 'bg-gradient-to-br from-gray-800 to-gray-900 text-gray-100 border border-gray-700/50'
                }`}
              >
                <div className="whitespace-pre-wrap break-words leading-relaxed">
                  {message.content}
                </div>
                {message.model && message.model !== 'error' && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2.5 pt-2 border-t border-gray-700/30">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 7H7v6h6V7z" />
                      <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">{message.model}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start animate-slide-in">
              <div className="max-w-[80%] rounded-2xl px-5 py-3.5 bg-gradient-to-br from-gray-800 to-gray-900 text-gray-400 border border-gray-700/50 shadow-lg">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-t border-gray-700/50 px-4 py-6 shadow-2xl backdrop-blur-sm">
        <form onSubmit={sendMessage} className="max-w-2xl mx-auto">
          <div className="flex space-x-3 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 bg-gray-700/50 text-gray-100 rounded-xl px-5 py-6 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-gray-700 placeholder-gray-500 disabled:opacity-50 transition-all duration-200 shadow-inner border border-gray-600/30"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-8 py-6 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App
