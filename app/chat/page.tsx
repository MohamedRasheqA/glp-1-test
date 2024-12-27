"use client"

import { useState, useEffect, useRef } from 'react';
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageCircle, Send, ThumbsUp, ThumbsDown, Loader2, Activity, Pill, Plus, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Components } from 'react-markdown';

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: string;
  feedback?: number;
  sources?: { [key: string]: string };
}

interface DetailedFeedbackProps {
  messageContent: string;
  messageId: string;
  onClose: () => void;
}

interface Memory {
  id: string;
  question: string;
  question_summary: string;
  timestamp: string;
  distance: number;
}

type PersonaConfig = {
  [key: string]: {
    icon: JSX.Element;
    color: string;
    shortName: string;
  }
};

const personaConfig: PersonaConfig = {
  general_med: {
    icon: <Activity className="h-4 w-4" />,
    color: '#FE3301',
    shortName: 'General'
  },
  glp1: {
    icon: <Pill className="h-4 w-4" />,
    color: '#00C48C',
    shortName: 'GLP-1'
  }
};

interface MessageContentProps {
  content: string;
  sources?: { [key: string]: string };
}

const MessageContent = ({ content, sources = {} }: MessageContentProps) => {
  return (
    <ReactMarkdown
      components={{
        // Style paragraphs
        p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
        
        // Style headings
        h1: ({ children }) => <h1 className="text-2xl font-bold mb-4">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xl font-bold mb-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-lg font-bold mb-2">{children}</h3>,
        
        // Style lists
        ul: ({ children }) => <ul className="list-disc list-inside mb-4">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-4">{children}</ol>,
        
        // Style code blocks and inline code
        code: ({ node, inline, className, children, ...props }: {
          node?: any;
          inline?: boolean;
          className?: string;
          children?: React.ReactNode;
          [key: string]: any;
        }) => {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              style={oneDark}
              language={match[1]}
              PreTag="div"
              className="rounded-md mb-4"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className="bg-gray-100 rounded px-1 py-0.5" {...props}>
              {children}
            </code>
          );
        },
        
        // Style links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FE3301] hover:underline"
          >
            {children}
          </a>
        ),
        
        // Style blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-200 pl-4 italic mb-4">
            {children}
          </blockquote>
        ),
        
        // Style tables
        table: ({ children }) => (
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full divide-y divide-gray-200">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2 bg-gray-50 text-left text-sm font-medium text-gray-500">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2 text-sm text-gray-900">
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

// Global state for session maintenance
const globalState = {
  messages: [] as ChatMessage[],
  selectedPersona: 'general_med',
  similarQuestions: [] as Memory[],
  isProcessing: false,
  sessionActive: false,
  isLoading: false,
  isTyping: false,
  currentRequest: null as AbortController | null,
  activeQuery: null as string | null
};

const DetailedFeedback = ({ messageContent, messageId, onClose }: DetailedFeedbackProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [userFeedback, setUserFeedback] = useState('');

  const handleSubmitFeedback = async () => {
    if (!userFeedback.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          feedback: 0,
          messageContent,
          userSuggestion: userFeedback,
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to store feedback');
      }

      toast.success('Thank you for your feedback!');
      onClose();
    } catch (error) {
      console.error('Error storing feedback:', error);
      toast.error('Failed to save feedback');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>We'd Love Your Feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-4">
            <label className="block text-gray-700">
              What could we do better?
              <textarea 
                value={userFeedback}
                onChange={(e) => setUserFeedback(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#FE3301] focus:ring-[#FE3301] sm:text-sm min-h-[100px] p-2"
                placeholder="Please share your suggestions for improvement..."
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitFeedback}
                disabled={isLoading || !userFeedback.trim()}
                className="bg-[#FE3301] text-white hover:bg-[#FE3301]/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>(globalState.messages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(globalState.isLoading);
  const [isTyping, setIsTyping] = useState(globalState.isTyping);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState<string | null>(null);
  const [similarQuestions, setSimilarQuestions] = useState<Memory[]>(globalState.similarQuestions);
  const [selectedPersona, setSelectedPersona] = useState(globalState.selectedPersona);
  const [title, setTitle] = useState('Medication Assistant Discussion');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef<boolean>(false);

  const scrollToBottom = () => {
    const chatContainer = messagesEndRef.current?.closest('.chat-container');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setMessages(globalState.messages);
        setSimilarQuestions(globalState.similarQuestions);
        setSelectedPersona(globalState.selectedPersona);
        
        if (globalState.activeQuery || globalState.currentRequest) {
          setIsLoading(true);
          setIsTyping(true);
          globalState.isLoading = true;
          globalState.isTyping = true;
        }

        if (!globalState.isProcessing) {
          processingRef.current = false;
          setIsLoading(false);
          setIsTyping(false);
          globalState.isLoading = false;
          globalState.isTyping = false;
        }
      }
    };

    // Initial check for ongoing requests
    if (globalState.activeQuery || globalState.currentRequest) {
      setIsLoading(true);
      setIsTyping(true);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isLoading]);

  const storeMemory = async (question: string) => {
    try {
      const response = await fetch('/api/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        throw new Error('Failed to store memory');
      }

      return await response.json();
    } catch (error) {
      console.error('Error storing memory:', error);
    }
  };

  const getSimilarQuestions = async (query: string) => {
    try {
      const response = await fetch(`/api/memory?query=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Failed to fetch similar questions');
      
      const data = await response.json();
      if (data.status === 'success') {
        setSimilarQuestions(data.memories);
        globalState.similarQuestions = data.memories;
      }
    } catch (error) {
      console.error('Error fetching similar questions:', error);
    }
  };

  const handleFeedback = async (index: number, value: number) => {
    const message = messages[index];
    if (!message || message.type !== 'bot') return;

    if (value === 0) {
      setShowDetailedFeedback(message.id);
      return;
    }

    const updatedMessages = messages.map((msg, i) => {
      if (i === index) {
        return { ...msg, feedback: value };
      }
      return msg;
    });

    setMessages(updatedMessages);
    globalState.messages = updatedMessages;

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

      if (!response.ok) {
        throw new Error('Failed to store feedback');
      }

      toast.success('Feedback saved');
    } catch (error) {
      console.error('Error storing feedback:', error);
      
      const revertedMessages = messages.map((msg, i) => {
        if (i === index) {
          return { ...msg, feedback: undefined };
        }
        return msg;
      });

      setMessages(revertedMessages);
      globalState.messages = revertedMessages;

      toast.error('Failed to save feedback');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || processingRef.current) return;

    let timeoutId: NodeJS.Timeout | undefined;
    const abortController = new AbortController();
    globalState.currentRequest = abortController;
    globalState.activeQuery = input;

    processingRef.current = true;
    globalState.isProcessing = true;
    setIsLoading(true);
    setIsTyping(true);
    globalState.isLoading = true;
    globalState.isTyping = true;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    globalState.messages = updatedMessages;

    setInput('');

    try {
      await Promise.all([
        storeMemory(input),
        getSimilarQuestions(input)
      ]);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: input,
          similarQuestions: similarQuestions,
          persona: selectedPersona
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      if (data.status === 'success' && data.response) {
        if (data.title) setTitle(data.title);
        const botMessage: ChatMessage = {
          id: crypto.randomUUID(),
          type: 'bot',
          content: data.response,
          timestamp: new Date().toISOString(),
        };
        console.log("title", data.title);
        const newMessages = [...updatedMessages, botMessage];
        setMessages(newMessages);
        globalState.messages = newMessages;
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        type: 'bot',
        content: 'Sorry, there was an error processing your request.',
        timestamp: new Date().toISOString()
      };

      const newMessages = [...updatedMessages, errorMessage];
      setMessages(newMessages);
      globalState.messages = newMessages;
    } finally {
      if (globalState.currentRequest === abortController) {
        setIsLoading(false);
        setIsTyping(false);
        globalState.isLoading = false;
        globalState.isTyping = false;
        processingRef.current = false;
        globalState.isProcessing = false;
        globalState.currentRequest = null;
        globalState.activeQuery = null;
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-t from-[#FFF5F2] via-[#FFF9F7] to-white">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-[#FE3301]">
          Medication Assistant
        </h1>
        
        <Card className="max-w-4xl mx-auto bg-white/80 backdrop-blur-sm shadow-lg">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-[#FE3301]">
              <MessageCircle className="h-6 w-6" />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col h-[calc(100vh-20rem)]">
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 chat-container scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                {messages.map((message, index) => (
                  <div 
                    key={message.id} 
                    className="w-full"
                  >
                    <div className="w-full">
                      {message.type === 'bot' ? (
                        <div className="text-sm text-gray-600 mb-1">AI Assistant</div>
                      ) : (
                        <div className="text-sm text-gray-600 mb-1">You</div>
                      )}
                      <div 
                        className={`rounded-lg p-4 ${
                          message.type === 'user' 
                            ? 'bg-gradient-to-r from-[#FFE5E0] to-[#FFE9E5] border border-[#FE330125]' 
                            : 'bg-white border border-gray-100'
                        }`}
                      >
                        <MessageContent content={message.content} sources={message.sources} />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-xs text-gray-500">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                        {message.type === 'bot' && (
                          <div className="flex gap-2">
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
                  </div>
                ))}
                {(isTyping || isLoading) && (
                  <div className="w-full">
                    <div className="bg-white border border-gray-100 rounded-lg p-4">
                      <div className="flex space-x-2 justify-center items-center h-6">
                        <span className="sr-only">Loading...</span>
                        <div className="h-2 w-2 bg-[#FE3301] rounded-full animate-bounce"></div>
                        <div className="h-2 w-2 bg-[#FE3301] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="h-2 w-2 bg-[#FE3301] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
                <div className="flex-1 flex gap-2">
                  <Select
                    value={selectedPersona}
                    onValueChange={setSelectedPersona}
                  >
                    <SelectTrigger className="w-10 h-10 p-0 border-none bg-transparent hover:bg-gray-100 rounded-full flex items-center justify-center">
                      {selectedPersona ? (
                        <div style={{ color: personaConfig[selectedPersona].color }}>
                          {personaConfig[selectedPersona].icon}
                        </div>
                      ) : (
                        <Plus className="h-4 w-4 text-gray-400" />
                      )}
                    </SelectTrigger>
                    <SelectContent align="start" className="w-[200px]">
                      {Object.entries(personaConfig).map(([key, config]) => (
                        <SelectItem 
                          key={key} 
                          value={key}
                          className="flex items-center gap-2"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <div style={{ color: config.color }}>
                                {config.icon}
                              </div>
                              <span>{config.shortName}</span>
                            </div>
                            {selectedPersona === key && (
                              <Check className="h-4 w-4" />
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                </div>
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

      {showDetailedFeedback && (
        <DetailedFeedback
          messageId={showDetailedFeedback}
          messageContent={messages.find(m => m.id === showDetailedFeedback)?.content || ''}
          onClose={() => setShowDetailedFeedback(null)}
        />
      )}

      <style jsx global>{`
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-bounce {
          animation: bounce 0.6s infinite;
        }

        .backdrop-blur-sm {
          backdrop-filter: blur(8px);
        }

        .prose a {
          color: #FE3301;
          text-decoration: none;
        }

        .prose a:hover {
          text-decoration: underline;
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

        .memory-indicator {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background-color: #FE3301;
          border: 2px solid white;
          animation: pulse 2s infinite;
        }

        .similar-questions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #FE330115;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 10;
          max-height: 200px;
          overflow-y: auto;
        }

        .similar-question-item {
          padding: 8px 12px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .similar-question-item:hover {
          background-color: #FFF5F2;
        }

        @media (max-width: 640px) {
          .max-w-[80%] {
            max-width: 85%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-bounce,
          .memory-indicator {
            animation: none;
          }
        }

        @media (forced-colors: active) {
          .memory-indicator {
            border: 2px solid CanvasText;
            background-color: Highlight;
          }
          
          .similar-question-item:hover {
            background-color: Highlight;
            color: HighlightText;
          }
        }
      `}</style>
    </div>
  );
}
