"use client"
import { useState } from 'react';
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send, ThumbsUp, ThumbsDown } from "lucide-react";
import toast from 'react-hot-toast';

interface ChatMessage {
  id: string; // Add unique identifier for messages
  type: 'user' | 'bot';
  content: string;
  timestamp: string;
  feedback?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const formatMarkdown = (content: string): React.ReactNode => {
  if (!content) return null;
  return <p className="break-words">{content}</p>;
};

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const handleFeedback = async (index: number, value: number) => {
    const message = messages[index];
    if (!message || message.type !== 'bot') return;

    // Optimistic update
    setMessages(prevMessages => {
      const newMessages = [...prevMessages];
      newMessages[index] = {
        ...newMessages[index],
        feedback: value
      };
      return newMessages;
    });

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: message.id,
          feedback: value,
          messageContent: message.content,
          timestamp: message.timestamp
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to store feedback');
      }

      if (data.usedFallback) {
        toast.success('Feedback saved to backup system');
      } else if (data.usedLocal) {
        toast.success('Feedback saved locally - will sync later');
      } else {
        toast.success('Feedback saved');
      }

    } catch (error) {
      console.error('Error storing feedback:', error);
      
      // Revert the optimistic update
      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        newMessages[index] = {
          ...newMessages[index],
          feedback: undefined
        };
        return newMessages;
      });

      toast.error('Failed to save feedback');

      // Store failed feedback attempt locally for retry
      const pendingFeedback = JSON.parse(localStorage.getItem('pendingFeedback') || '[]');
      pendingFeedback.push({
        messageId: message.id,
        feedback: value,
        messageContent: message.content,
        timestamp: message.timestamp,
        retryCount: 0,
        lastRetry: new Date().toISOString()
      });
      localStorage.setItem('pendingFeedback', JSON.stringify(pendingFeedback));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(), // Generate unique ID
      type: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: input }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      console.log('API Response:', data);
      
      if (data.status === 'success' && data.response) {
        const botMessage: ChatMessage = {
          id: crypto.randomUUID(), // Generate unique ID
          type: 'bot',
          content: data.response,
          timestamp: new Date().toISOString(),
        };
        console.log('Bot Message:', botMessage);
        setMessages(prev => [...prev, botMessage]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(), // Generate unique ID
        type: 'bot',
        content: 'Sorry, there was an error processing your request.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  // Rest of the component remains the same...
  return (
    <div className="min-h-screen bg-gradient-to-t from-[#FFF5F2] via-[#FFF9F7] to-white">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-[#FE3301]">
          GLP-1 Assistant
        </h1>
        
        <Card className="max-w-4xl mx-auto bg-white/80 backdrop-blur-sm shadow-lg">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-[#FE3301]">
              <MessageCircle className="h-6 w-6" />
              GLP-1 Discussion
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col h-[calc(100vh-20rem)]">
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                {messages.map((message, index) => (
                  <div 
                    key={message.id} 
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="flex flex-col">
                      <div 
                        className={`rounded-lg p-4 max-w-[85%] sm:max-w-[75%] ${
                          message.type === 'user' 
                            ? 'bg-gradient-to-r from-[#FE3301] to-[#FF6B47] text-white' 
                            : 'bg-gradient-to-r from-[#FFF5F2] to-[#FFF9F7] border border-[#FE330115]'
                        }`}
                      >
                        {message.type === 'user' ? (
                          <p className="break-words">{message.content}</p>
                        ) : (
                          formatMarkdown(message.content)
                        )}
                      </div>
                      {message.type === 'bot' && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFeedback(index, 1)}
                            className={`p-2 hover:bg-green-100 ${
                              message.feedback === 1 ? 'bg-green-100' : ''
                            }`}
                          >
                            <ThumbsUp className={`h-4 w-4 ${
                              message.feedback === 1 ? 'text-green-600' : 'text-gray-500'
                            }`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFeedback(index, 0)}
                            className={`p-2 hover:bg-red-100 ${
                              message.feedback === 0 ? 'bg-red-100' : ''
                            }`}
                          >
                            <ThumbsDown className={`h-4 w-4 ${
                              message.feedback === 0 ? 'text-red-600' : 'text-gray-500'
                            }`} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(isTyping || isLoading) && (
                  <div className="flex justify-start">
                    <div className="bg-gradient-to-r from-[#FFF5F2] to-[#FFF9F7] rounded-lg p-4 border border-[#FE330115] max-w-[85%] sm:max-w-[75%]">
                      <div className="flex space-x-2 justify-center items-center h-6">
                        <span className="sr-only">Loading...</span>
                        <div className="h-2 w-2 bg-[#FE3301] rounded-full animate-pulse"></div>
                        <div className="h-2 w-2 bg-[#FE3301] rounded-full animate-pulse delay-150"></div>
                        <div className="h-2 w-2 bg-[#FE3301] rounded-full animate-pulse delay-300"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="bg-[#FE3301] text-white hover:bg-[#FE3301]/90"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </main>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .animate-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .delay-150 { animation-delay: 150ms; }
        .delay-300 { animation-delay: 300ms; }
        
        .backdrop-blur-sm {
          backdrop-filter: blur(8px);
        }

        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }

        .scrollbar-thumb-gray-300::-webkit-scrollbar-thumb {
          background-color: #D1D5DB;
          border-radius: 3px;
        }

        .scrollbar-track-transparent::-webkit-scrollbar-track {
          background-color: transparent;
        }
      `}</style>
    </div>
  );
}