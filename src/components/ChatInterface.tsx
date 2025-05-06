import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User } from "lucide-react";

// Define message type matching App.tsx
interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

interface ChatInterfaceProps {
  onSendCommand: (command: string) => Promise<string>;
  chatHistory: ChatMessage[]; // Receive history from App
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>; // Receive setter from App
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onSendCommand, chatHistory, setChatHistory }) => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when chat history updates
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector("div[data-radix-scroll-area-viewport]");
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [chatHistory]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userCommand = input;
    setInput("");
    setIsLoading(true);

    // Add user message immediately (handled by App.tsx now)
    // setChatHistory(prev => [...prev, { sender: "user", text: userCommand }]);

    try {
      // Call the handler in App.tsx, which will update history
      await onSendCommand(userCommand);
    } catch (error) {
      console.error("Error sending command:", error);
      // Add error message to history via App.tsx state
      setChatHistory(prev => [...prev, { sender: "ai", text: "Sorry, an error occurred while processing your request." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 w-80 h-96 flex flex-col glass-card z-50">
      <CardContent className="flex-grow p-4 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="space-y-4 pr-4">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex items-start gap-2 ${msg.sender === "user" ? "justify-end" : ""}`}>
                {msg.sender === "ai" && <Bot className="h-5 w-5 text-blue-400 flex-shrink-0" />}
                <div className={`rounded-lg p-2 max-w-[80%] ${msg.sender === "user" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-200"}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                </div>
                {msg.sender === "user" && <User className="h-5 w-5 text-gray-400 flex-shrink-0" />}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-2">
                <Bot className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <div className="rounded-lg p-2 bg-gray-700 text-gray-400 italic">
                  <p className="text-sm">AI is thinking...</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-2 border-t border-gray-700">
        <div className="flex w-full items-center gap-2">
          <Textarea
            placeholder="Ask AI... (e.g., add goal Car for 100k)"
            className="flex-grow resize-none border-gray-600 bg-gray-800 text-gray-200 placeholder-gray-500 focus:ring-blue-500"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="sm">
            Send
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ChatInterface;

