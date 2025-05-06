export interface Transaction {
  id: string;
  date: string; // ISO string format
  description: string;
  amount: number; // Positive for income, negative for expense
  category: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string; // Optional deadline (ISO string)
  estimatedCompletionDate?: string; // Calculated ETA (ISO string)
}

// Corrected PredictedIncome type to include source
export interface PredictedIncome {
  id: string;
  date: string; // ISO string format
  source: string; // Description of the income source (e.g., Salary)
  amount: number;
  // Optional: Add recurrence rule if needed
}

