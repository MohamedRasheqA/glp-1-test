'use client'
import { useState, useEffect, useRef } from 'react';
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send, Plus, Check, Activity, Pill } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

interface ChatMessage {
  type: 'user' | 'bot';
  content: string;
  timestamp: string;
}

const MessageContent = ({ content }: { content: string }) => {
  const formatText = (text: string) => {
    // Format headings with ###
    text = text.replace(/###\s+(.+)/g, '<h3 class="font-bold text-lg mb-2">$1</h3>');
    
    // Format bold text with **
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Format bullet points
    text = text.replace(/^\s*-\s+(.+?)$/gm, '<li>$1</li>');
    
    // Format external links with @ symbol
    text = text.replace(
      /@(https?:\/\/[^\s]+)/g,
      '<a href="$1" class="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Format citations
    text = text.replace(
      /\[(\d+)\]/g,
      '<a href="#source-$1" class="text-[#FE3301] hover:underline">[$1]</a>'
    );
    
    // Format source links - specifically for the Sources section
    text = text.replace(
      /^- \*\*(.*?)\*\*: (https?:\/\/[^\s]+)$/gm,
      '- <a href="$2" class="text-[#FE3301] hover:underline" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    return text;
  };

  const formattedContent = formatText(content);

  return (
    <div 
      className="whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: formattedContent }}
    />
  );
};

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

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedPersona, setSelectedPersona] = useState('general_med');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add personas data
  const personas = [
    {
      id: "glp1",
      name: "GLP-1 Specialist",
      description: "Specialized in GLP-1 medications"
    },
    {
      id: "general_med",
      name: "General Medical Assistant", 
      description: "General medication knowledge"
    }
  ];

  const scrollToBottom = () => {
    // Find the chat container and scroll it
    const chatContainer = messagesEndRef.current?.closest('.chat-container');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    const userMessage: ChatMessage = {
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
        body: JSON.stringify({ 
          query: input,
          persona: selectedPersona 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      if (data.status === 'success' && data.response) {
        const botMessage: ChatMessage = {
          type: 'bot',
          content: data.response,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, botMessage]);
      }
      setIsTyping(false);
    } catch (error) {
      const errorMessage: ChatMessage = {
        type: 'bot',
        content: 'Sorry, there was an error processing your request.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsTyping(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-t from-[#FFF5F2] via-[#FFF9F7] to-white"></div>
      
      <div className="relative z-10">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-center mb-8 text-[#FE3301]">
            Med-Assistant
          </h1>
          
          <Card className="max-w-4xl mx-auto bg-white/80 backdrop-blur-sm shadow-lg">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-[#FE3301]">
                <MessageCircle className="h-6 w-6" />
                Med-Assistant Discussion
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="chat-container h-[60vh] overflow-y-auto pr-4 space-y-4">
                  {messages.map((message, index) => (
                    <div 
                      key={index} 
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
                          <MessageContent content={message.content} />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(isTyping || isLoading) && (
                    <div className="w-full">
                      <div className="bg-gradient-to-[#FFF9F7] rounded-lg p-4 border border-[#FE330115]">
                        <div className="flex space-x-2 justify-center items-center">
                          <span className="sr-only">Loading...</span>
                          <div className="h-3 w-3 bg-[#FE3301] rounded-full animate-bounce"></div>
                          <div className="h-3 w-3 bg-[#FE3301] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="h-3 w-3 bg-[#FE3301] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <div className="flex-1 flex gap-2 relative">
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
                      onKeyDown={handleKeyDown}
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
      </div>

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

        @media (max-width: 640px) {
          .max-w-[80%] {
            max-width: 85%;
          }
        }
      `}</style>
    </div>
  );
}
