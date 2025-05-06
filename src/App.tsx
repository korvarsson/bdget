import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO, addMonths, startOfMonth, endOfMonth, isValid, subMonths, addDays, startOfWeek, nextSaturday, previousTuesday, parse as parseDate } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { Transaction, Goal, PredictedIncome } from './types';
import Settings from './components/Settings';
import GoalsView from './components/GoalsView';
import ChatInterface from './components/ChatInterface';
import BudgetCalendarView from './components/BudgetCalendarView';
import { loadFromLocalStorage, saveToLocalStorage } from './lib/secureStorage';

// Helper function for currency formatting
export const formatCurrency = (amount: number, currencyCode: string = 'CZK', locale: string = 'cs-CZ') => {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(amount);
  } catch (error) {
    console.error("Error formatting currency:", error);
    return `${amount.toFixed(2)} ${currencyCode}`; // Fallback format
  }
};

// Mini Dashboard Component
interface MiniGoalDashboardProps {
  goals: Goal[];
}

const MiniGoalDashboard: React.FC<MiniGoalDashboardProps> = ({ goals }) => {
  const sortedGoals = [...goals].sort((a, b) => {
    const etaA = a.estimatedCompletionDate ? parseISO(a.estimatedCompletionDate).getTime() : Infinity;
    const etaB = b.estimatedCompletionDate ? parseISO(b.estimatedCompletionDate).getTime() : Infinity;
    return etaA - etaB;
  });

  return (
    <Card className="glass-card mt-4">
      <CardHeader>
        <CardTitle className="text-lg text-gray-100">Goal Snowball</CardTitle> {/* Ensure light text */}
        <CardDescription className="text-sm text-gray-300">Estimated completion dates</CardDescription> {/* Ensure light text */}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[150px]">
          {sortedGoals.length > 0 ? (
            <ul className="space-y-2">
              {sortedGoals.map(goal => (
                <li key={goal.id} className="text-xs flex justify-between text-gray-200"> {/* Ensure light text */}
                  <span>{goal.name}</span>
                  <span className="font-medium">
                    {goal.estimatedCompletionDate ? format(parseISO(goal.estimatedCompletionDate), 'MMM yyyy') : 'N/A'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">No goals set yet.</p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Define message type for chat history
interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = loadFromLocalStorage('transactions');
    return saved ? JSON.parse(saved) : [];
  });
  const [goals, setGoals] = useState<Goal[]>(() => {
    const saved = loadFromLocalStorage('goals');
    return saved ? JSON.parse(saved) : [];
  });
  const [predictedIncome, setPredictedIncome] = useState<PredictedIncome[]>(() => {
    const saved = loadFromLocalStorage('predictedIncome');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentView, setCurrentView] = useState<'dashboard' | 'calendar' | 'goals' | 'settings'>('dashboard');
  const [selectedCurrency, setSelectedCurrency] = useState<string>(() => {
    return loadFromLocalStorage('selectedCurrency') || 'CZK'; // Default to CZK
  });
  // State for persistent chat history
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    const saved = loadFromLocalStorage('chatHistory');
    return saved ? JSON.parse(saved) : [];
  });

  // Save data to localStorage whenever it changes
  useEffect(() => {
    saveToLocalStorage('transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    saveToLocalStorage('goals', JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    saveToLocalStorage('predictedIncome', JSON.stringify(predictedIncome));
  }, [predictedIncome]);

  useEffect(() => {
    saveToLocalStorage('selectedCurrency', selectedCurrency);
  }, [selectedCurrency]);

  // Save chat history
  useEffect(() => {
    saveToLocalStorage('chatHistory', JSON.stringify(chatHistory));
  }, [chatHistory]);

  // Calculate current balance and monthly summary
  const { currentBalance, monthlyIncome, monthlyExpenses } = useMemo(() => {
    const balance = transactions.reduce((acc, t) => acc + t.amount, 0);
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    let income = 0;
    let expenses = 0;
    transactions.forEach(t => {
      const tDate = parseISO(t.date);
      if (isValid(tDate) && tDate >= currentMonthStart && tDate <= currentMonthEnd) {
        if (t.amount > 0) income += t.amount;
        else expenses += t.amount;
      }
    });
    return { currentBalance: balance, monthlyIncome: income, monthlyExpenses: Math.abs(expenses) };
  }, [transactions]);

  // Goal Reactor Logic: Update ETAs when transactions or goals change
  useEffect(() => {
    const updatedGoals = goals.map(goal => {
      const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
      if (remainingAmount === 0) {
        return { ...goal, estimatedCompletionDate: new Date().toISOString() }; // Already completed
      }
      const threeMonthsAgo = startOfMonth(subMonths(new Date(), 3));
      const recentTransactions = transactions.filter(t => isValid(parseISO(t.date)) && parseISO(t.date) >= threeMonthsAgo);
      const totalRecentIncome = recentTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
      const totalRecentExpenses = recentTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0);
      const averageMonthlySavings = (totalRecentIncome + totalRecentExpenses) / 3;
      if (averageMonthlySavings <= 0) {
        return { ...goal, estimatedCompletionDate: undefined };
      }
      const monthsNeeded = Math.ceil(remainingAmount / averageMonthlySavings);
      const estimatedDate = addMonths(new Date(), monthsNeeded);
      return { ...goal, estimatedCompletionDate: estimatedDate.toISOString() };
    });
    if (JSON.stringify(updatedGoals) !== JSON.stringify(goals)) {
        setGoals(updatedGoals);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  const handleImportTransactions = (importedTransactions: Omit<Transaction, 'id'>[]) => {
    const newTransactions = importedTransactions.map(t => ({ ...t, id: uuidv4() }));
    setTransactions(prev => [...prev, ...newTransactions]);
  };

  const handleAddGoal = (goal: Omit<Goal, 'id' | 'currentAmount' | 'estimatedCompletionDate'>) => {
    const newGoal = { ...goal, id: uuidv4(), currentAmount: 0 };
    setGoals(prev => [...prev, newGoal]);
    return newGoal; // Return the newly created goal
  };

  const handleUpdateGoal = (updatedGoal: Goal) => {
    setGoals(prev => prev.map(g => g.id === updatedGoal.id ? updatedGoal : g));
  };

  const handleDeleteGoal = (goalId: string) => {
    setGoals(prev => prev.filter(g => g.id !== goalId));
  };

  const handleAddPredictedIncome = (income: Omit<PredictedIncome, 'id'>) => {
    setPredictedIncome(prev => [...prev, { ...income, id: uuidv4() }]);
  };

  const handleEditTransaction = (updatedTransaction: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));
  };

  const handleDeleteTransaction = (transactionId: string) => {
    setTransactions(prev => prev.filter(t => t.id !== transactionId));
  };

  // Enhanced AI interaction logic
  const handleAiCommand = async (command: string) => {
    console.log("AI Command Received:", command);
    // Add user message to history
    setChatHistory(prev => [...prev, { sender: 'user', text: command }]);

    let responseText = "Processing your request...";

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // --- Enhanced Command Parsing & Execution ---
    const lowerCommand = command.toLowerCase()
    // 1. Goal Creation (Improved)
    if (lowerCommand.includes("create goal") || lowerCommand.includes("add goal")) {
      const nameMatch = lowerCommand.match(/(?:goal|for|to buy) (.*?)(?: for | with | costing | of | target | deadline|$)/i);
      const amountMatch = lowerCommand.match(/(\d{1,3}(?:[ ,\s\u00A0]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?: ?czk| ?kč| ?eur| ?usd| ?\$| ?€)?/i);
      const deadlineMatch = lowerCommand.match(/(?:by|deadline) (.*?)(?:$)/i);

      const goalName = nameMatch?.[1]?.trim() || "New Goal";
      const goalAmountStr = amountMatch?.[1]?.replace(/[ ,\s\u00A0]/g, "").replace(",", ".");
      const goalAmount = goalAmountStr ? parseFloat(goalAmountStr) : 0;
      let deadline: string | undefined = undefined;

      if (deadlineMatch?.[1]) {
        // Basic deadline parsing (improve if needed)
        try {
          const parsedDeadline = parseDate(deadlineMatch[1].trim(), "P", new Date());
          if (isValid(parsedDeadline)) {
            deadline = format(parsedDeadline, "yyyy-MM-dd");
          }
        } catch (e) { /* Ignore deadline parse error */ }
      }

      if (goalAmount > 0 && goalName !== "New Goal") {
        const newGoalData: Omit<Goal, "id" | "currentAmount" | "estimatedCompletionDate"> = {
          name: goalName,
          targetAmount: goalAmount,
        };
        if (deadline) {
          newGoalData.deadline = deadline;
        }
        const newGoal = handleAddGoal(newGoalData);
        responseText = `OK, I've added the goal "${newGoal.name}" for ${formatCurrency(newGoal.targetAmount, selectedCurrency)}${deadline ? ` with a deadline of ${format(parseISO(deadline), "PPP")}` : ""}. I'll estimate the completion date.`;
      } else {
        responseText = "Sorry, I couldn't understand the goal details. Please specify a name and amount, like 'add goal New Car for 100000'. You can optionally add 'by YYYY-MM-DD'.";
      }
    }
    // 2. Spending Analysis (Improved Keyword Matching)
    else if (lowerCommand.includes("how much") && (lowerCommand.includes("spend") || lowerCommand.includes("spent"))) {
      const lastMonthMatch = lowerCommand.includes("last month");
      const thisMonthMatch = lowerCommand.includes("this month"); // Check for "this month"
      const keywordMatch = lowerCommand.match(/(?:on|for) (.*?)(?: last month| this month|\?)?$/i);
      const keyword = keywordMatch?.[1]?.trim();

      const targetDate = new Date();
      if (lastMonthMatch) {
        targetDate.setMonth(targetDate.getMonth() - 1);
      } else if (!thisMonthMatch) {
        // Default to current month if neither "last month" nor "this month" is specified
      }

      const monthStart = startOfMonth(targetDate);
      const monthEnd = endOfMonth(targetDate);

      let totalSpent = 0;
      let matchingTransactions = 0;
      transactions.forEach(t => {
        const tDate = parseISO(t.date);
        if (isValid(tDate) && tDate >= monthStart && tDate <= monthEnd && t.amount < 0) {
          // Check if keyword exists and matches category or description (case-insensitive)
          if (!keyword || 
              (t.category && t.category.toLowerCase().includes(keyword)) || 
              (t.description && t.description.toLowerCase().includes(keyword))) {
            totalSpent += t.amount;
            matchingTransactions++;
          }
        }
      });

      const timeFrame = lastMonthMatch ? "last month" : "this month";
      if (keyword) {
         responseText = matchingTransactions > 0
           ? `You spent ${formatCurrency(Math.abs(totalSpent), selectedCurrency)} on "${keyword}" ${timeFrame} across ${matchingTransactions} transactions.`
           : `I couldn't find any spending related to "${keyword}" ${timeFrame}.`;
      } else {
         responseText = `You spent a total of ${formatCurrency(Math.abs(totalSpent), selectedCurrency)} ${timeFrame}.`;
      }
    }
    // 3. Add Transaction (Improved Date Parsing)
    else if (lowerCommand.includes('add expense') || lowerCommand.includes('add income') || lowerCommand.includes('spent') || lowerCommand.includes('received')) {
        const isExpense = lowerCommand.includes('expense') || lowerCommand.includes('spent');
        const amountMatch = lowerCommand.match(/(\d{1,3}(?:[ ,\s]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/);
        const descriptionMatch = lowerCommand.match(/(?:expense|income|spent|received)(?: of | )\d.*? (?:for|on) (.*?)(?: on | tomorrow| today| yesterday| next| last)?$/);
        const dateMatch = lowerCommand.match(/(?: on | at | for )?(today|tomorrow|yesterday|next (?:week|weekend|saturday|sunday|monday|tuesday|wednesday|thursday|friday)|last (?:week|weekend|saturday|sunday|monday|tuesday|wednesday|thursday|friday)|\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)$/);

        const amountStr = amountMatch?.[1]?.replace(/[ ,\s]/g, '').replace(',', '.');
        const amountVal = amountStr ? parseFloat(amountStr) : 0;
        let description = descriptionMatch?.[1]?.trim() || 'Transaction';
        let transactionDate = new Date(); // Default to today

        if (dateMatch?.[1]) {
            const dateStr = dateMatch[1].toLowerCase();
            const now = new Date();
            if (dateStr === 'today') {
                transactionDate = now;
            } else if (dateStr === 'tomorrow') {
                transactionDate = addDays(now, 1);
            } else if (dateStr === 'yesterday') {
                transactionDate = addDays(now, -1);
            } else if (dateStr.startsWith('next week')) {
                transactionDate = addDays(startOfWeek(addDays(now, 7), { weekStartsOn: 1 }), 4); // Default to next Friday
            } else if (dateStr.startsWith('last week')) {
                transactionDate = addDays(startOfWeek(addDays(now, -7), { weekStartsOn: 1 }), 4); // Default to last Friday
            } else if (dateStr === 'next weekend') {
                transactionDate = nextSaturday(now);
            } else if (dateStr === 'last weekend') {
                transactionDate = previousTuesday(startOfWeek(now, { weekStartsOn: 1 })); // Approx last weekend
            } else {
                // Try parsing specific dates like dd/mm or dd/mm/yy
                try {
                    const parsed = parseDate(dateStr, 'P', new Date()); // Use date-fns parse
                    if (isValid(parsed)) transactionDate = parsed;
                } catch (e) { /* Ignore parse error, default to today */ }
            }
        }

        if (amountVal > 0) {
            const finalAmount = isExpense ? -amountVal : amountVal;
            const newTransaction: Transaction = {
                id: uuidv4(),
                date: format(transactionDate, 'yyyy-MM-dd'),
                description: description,
                amount: finalAmount,
                category: 'Uncategorized', // TODO: AI Categorization
            };
            // Use handleEditTransaction to add/update (it handles both)
            handleEditTransaction(newTransaction);
            responseText = `OK, added ${isExpense ? 'expense' : 'income'} of ${formatCurrency(Math.abs(finalAmount), selectedCurrency)} for "${description}" on ${format(transactionDate, 'MMM d')}.`;
        } else {
            responseText = "Sorry, I couldn't understand the amount or description for the transaction. Please try again, like 'add expense 500 for groceries tomorrow'.";
        }
    }
    // Default / Fallback
    else {
      responseText = "Sorry, I can currently help with adding goals (e.g., 'add goal Car for 100k by 2026-12-31'), adding transactions (e.g., 'add expense 500 for groceries tomorrow'), or analyzing spending (e.g., 'how much did I spend on fuel last month?').";
    }

    // Add AI response to history
    setChatHistory(prev => [...prev, { sender: 'ai', text: responseText }]);
    return responseText; // Return the response
  };

  // Render logic
  const renderView = () => {
    switch (currentView) {
      case 'calendar':
        return <BudgetCalendarView
          transactions={transactions}
          predictedIncome={predictedIncome}
          currencyCode={selectedCurrency}
          onAddPredictedIncome={handleAddPredictedIncome}
          onEditTransaction={handleEditTransaction}
          onDeleteTransaction={handleDeleteTransaction}
        />;
      case 'goals':
        return <GoalsView
          goals={goals}
          onAddGoal={handleAddGoal}
          onUpdateGoal={handleUpdateGoal}
          onDeleteGoal={handleDeleteGoal}
          currencyCode={selectedCurrency}
        />;
      case 'settings':
        return <Settings
          onImportTransactions={handleImportTransactions}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
        />;
      case 'dashboard':
      default:
        return (
          <div className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                {/* Ensure light text */} 
                <CardTitle className="text-gray-100">Overview</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-gray-100"> {/* Ensure light text */}
                Current Balance: {formatCurrency(currentBalance, selectedCurrency)}
              </CardContent>
              <CardContent className="text-sm text-gray-300"> {/* Ensure light text */}
                This Month: Income {formatCurrency(monthlyIncome, selectedCurrency)}, Expenses {formatCurrency(monthlyExpenses, selectedCurrency)}
              </CardContent>
            </Card>
            {/* Add more dashboard components here */}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col md:flex-row gap-8 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-gray-100">
      <aside className="w-full md:w-64 flex-shrink-0 space-y-4">
        <h1 className="text-2xl font-bold mb-6">Budget App</h1>
        <nav className="flex flex-row md:flex-col gap-2">
          <Button variant={currentView === 'dashboard' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('dashboard')} className="w-full justify-start">Dashboard</Button>
          <Button variant={currentView === 'calendar' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('calendar')} className="w-full justify-start">Calendar</Button>
          <Button variant={currentView === 'goals' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('goals')} className="w-full justify-start">Goals</Button>
          <Button variant={currentView === 'settings' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('settings')} className="w-full justify-start">Settings</Button>
        </nav>
        <MiniGoalDashboard goals={goals} />
      </aside>
      <main className="flex-grow">
        {renderView()}
      </main>
      {/* Pass chat history and setter to ChatInterface */}
      <ChatInterface 
        onSendCommand={handleAiCommand} 
        chatHistory={chatHistory} 
        setChatHistory={setChatHistory} 
      />
    </div>
  );
}

export default App;

