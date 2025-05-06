import React, { useState, useMemo } from "react";
import { Calendar, dateFnsLocalizer, EventProps } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, parseISO } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { cs } from "date-fns/locale/cs";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./CalendarView.css";
import { Transaction, PredictedIncome } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/App";
import { Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: Transaction | PredictedIncome;
  type: "transaction" | "predicted";
}

interface BudgetCalendarViewProps {
  transactions: Transaction[];
  predictedIncome: PredictedIncome[];
  currencyCode: string;
  onAddPredictedIncome: (income: Omit<PredictedIncome, "id">) => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
}

const locales = {
  "en-US": enUS,
  "cs": cs,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

// Helper function to check if a date is in the future
const isFutureDate = (selectedDate: Date | null): boolean => {
  if (!selectedDate) return false;
  // Only consider dates strictly after today as future/predicted
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set today to the beginning of the day
  const checkDate = new Date(selectedDate); // Clone to avoid modifying original state
  checkDate.setHours(0, 0, 0, 0); // Set selectedDate to the beginning of the day
  return checkDate > today;
};

// Custom Event Component
const CustomEvent: React.FC<EventProps<CalendarEvent>> = ({ event }) => {
  const isIncome = event.type === "predicted" || (event.type === "transaction" && (event.resource as Transaction).amount > 0);
  const amount = event.type === "predicted" ? (event.resource as PredictedIncome).amount : (event.resource as Transaction).amount;
  const currency = (event.resource as any).currencyCode || "CZK";
  const description = event.type === "predicted"
    ? `Pred. Income: ${(event.resource as PredictedIncome).source}`
    : (event.resource as Transaction).description;

  return (
    <div className={`rbc-event-content ${isIncome ? "income-event" : "expense-event"}`}>
      <span className="rbc-event-label" title={description}>{description}</span>
      <span className="rbc-event-amount">{formatCurrency(amount, currency)}</span>
    </div>
  );
};

const BudgetCalendarView: React.FC<BudgetCalendarViewProps> = ({
  transactions,
  predictedIncome,
  currencyCode,
  onAddPredictedIncome,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const [entryType, setEntryType] = useState<"income" | "expense">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Uncategorized");
  const [source, setSource] = useState("");

  const events: CalendarEvent[] = useMemo(() => {
    const transactionEvents = transactions.map((t) => ({
      id: t.id,
      title: `${t.description}: ${formatCurrency(t.amount, currencyCode)}`,
      start: parseISO(t.date),
      end: parseISO(t.date),
      allDay: true,
      resource: { ...t, currencyCode },
      type: "transaction" as "transaction",
    }));
    const predictedIncomeEvents = predictedIncome.map((p) => ({
      id: p.id,
      title: `Predicted: ${p.source} ${formatCurrency(p.amount, currencyCode)}`,
      start: parseISO(p.date),
      end: parseISO(p.date),
      allDay: true,
      resource: { ...p, currencyCode },
      type: "predicted" as "predicted",
    }));
    return [...transactionEvents, ...predictedIncomeEvents];
  }, [transactions, predictedIncome, currencyCode]);

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    setSelectedDate(slotInfo.start);
    setModalMode("add");
    setSelectedEvent(null);
    setEntryType("expense");
    setDescription("");
    setAmount("");
    setCategory("Uncategorized");
    setSource("");
    setIsModalOpen(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedDate(event.start);
    setModalMode("edit");
    if (event.type === "transaction") {
      const transaction = event.resource as Transaction;
      setEntryType(transaction.amount >= 0 ? "income" : "expense");
      setDescription(transaction.description);
      setAmount(String(Math.abs(transaction.amount)));
      setCategory(transaction.category);
      setSource("");
    } else {
      const income = event.resource as PredictedIncome;
      setEntryType("income");
      setDescription("");
      setAmount(String(income.amount));
      setCategory("");
      setSource(income.source);
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!selectedDate) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }
    const finalAmount = entryType === "expense" ? -parsedAmount : parsedAmount;
    const dateString = format(selectedDate, "yyyy-MM-dd");

    if (modalMode === "add") {
      // Use isFutureDate to determine if income is predicted
      if (entryType === "income" && isFutureDate(selectedDate)) {
        if (!source) {
          alert("Please enter a source for the predicted income.");
          return;
        }
        // Add as Predicted Income
        onAddPredictedIncome({ date: dateString, amount: finalAmount, source: source });
      } else {
        // Add as Actual Transaction (Expense or Past/Today Income)
        if (!description) {
          alert("Please enter a description.");
          return;
        }
        const newTransaction: Transaction = {
          id: uuidv4(),
          date: dateString,
          description: description,
          amount: finalAmount, // Will be negative for expense, positive for income
          category: category,
        };
        onEditTransaction(newTransaction); // Use onEditTransaction to add new
      }
    } else if (modalMode === "edit" && selectedEvent) {
      // Editing existing entries
      if (selectedEvent.type === "transaction") {
        // Edit existing transaction
        if (!description) {
          alert("Please enter a description.");
          return;
        }
        onEditTransaction({
          ...(selectedEvent.resource as Transaction),
          date: dateString,
          description: description,
          amount: finalAmount,
          category: category,
        });
      } else if (selectedEvent.type === "predicted") {
        // Edit existing predicted income (basic implementation)
        if (!source) {
          alert("Please enter a source for the predicted income.");
          return;
        }
        // Note: This assumes editing predicted income keeps it as predicted income.
        // A more complex logic might convert it to a transaction if the date is moved to the past.
        // For now, we just update the existing predicted income record.
        // We need an onUpdatePredictedIncome function passed from App.tsx
        // For simplicity now, let's prevent editing predicted income via this modal.
        alert("Editing predicted income details is not fully supported yet. Please delete and add a new one if needed.");
        // TODO: Implement onUpdatePredictedIncome in App.tsx and pass it down if full editing is desired.
      }
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (modalMode === "edit" && selectedEvent) {
      if (selectedEvent.type === "transaction") {
        if (window.confirm(`Delete transaction "${(selectedEvent.resource as Transaction).description}"?`)) {
          onDeleteTransaction(selectedEvent.id);
          setIsModalOpen(false);
        }
      } else {
        alert("Deleting predicted income is not supported yet.");
      }
    }
  };

  return (
    <div className="h-[70vh] bg-gray-800 p-4 rounded-lg glass-card">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "100%" }}
        selectable
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        culture={navigator.language.startsWith("cs") ? "cs" : "en-US"}
        views={["month", "week", "day"]}
        components={{ event: CustomEvent }}
        eventPropGetter={(event) => ({
          className: event.type === "predicted"
            ? "predicted-event"
            : (event.resource as Transaction).amount > 0
            ? "income-event"
            : "expense-event",
        })}
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="glass-card bg-gray-900/80 border border-gray-700 text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-gray-100">
              {modalMode === "edit" ? "Edit Entry" : "Add Entry"} for {selectedDate ? format(selectedDate, "PPP") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="entry-type" className="text-right text-gray-300">Type</Label>
              <Select value={entryType} onValueChange={(value) => setEntryType(value as "income" | "expense")}>
                <SelectTrigger id="entry-type" className="col-span-3 bg-gray-800 border-gray-600 text-gray-100">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600 text-gray-100">
                  <SelectItem value="expense" className="hover:bg-gray-700">Expense</SelectItem>
                  <SelectItem value="income" className="hover:bg-gray-700">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Show Source only for Future Income in Add mode */}
            {entryType === "income" && isFutureDate(selectedDate) && modalMode === "add" ? (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="source" className="text-right text-gray-300">Source</Label>
                  <Input id="source" value={source} onChange={(e) => setSource(e.target.value)} className="col-span-3 bg-gray-800 border-gray-600 text-gray-100" placeholder="e.g., Salary, Freelance" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="amount" className="text-right text-gray-300">Amount</Label>
                  <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="col-span-3 bg-gray-800 border-gray-600 text-gray-100" placeholder="Enter positive amount" />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right text-gray-300">Description</Label>
                  <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3 bg-gray-800 border-gray-600 text-gray-100" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="amount" className="text-right text-gray-300">Amount</Label>
                  <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="col-span-3 bg-gray-800 border-gray-600 text-gray-100" placeholder="Enter positive amount" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="category" className="text-right text-gray-300">Category</Label>
                  <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="col-span-3 bg-gray-800 border-gray-600 text-gray-100" />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="justify-between">
            <div>
              {modalMode === "edit" && selectedEvent?.type === "transaction" && (
                <Button variant="destructive" onClick={handleDelete} className="mr-2">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              )}
            </div>
            <div>
              <DialogClose asChild>
                <Button variant="outline" className="mr-2">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BudgetCalendarView;

