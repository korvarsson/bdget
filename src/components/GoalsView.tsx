import React, { useState } from "react";
import { Goal } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"; // For Edit Modal
import { Label } from "@/components/ui/label";
import { Trash2, Edit, PlusCircle } from "lucide-react";
import { formatCurrency } from "@/App";
import { parseISO, format } from "date-fns";

interface GoalsViewProps {
  goals: Goal[];
  onAddGoal: (goal: Omit<Goal, "id" | "currentAmount" | "estimatedCompletionDate">) => void;
  onUpdateGoal: (updatedGoal: Goal) => void;
  onDeleteGoal: (goalId: string) => void;
  currencyCode: string;
}

const GoalsView: React.FC<GoalsViewProps> = ({
  goals,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  currencyCode,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [currentGoal, setCurrentGoal] = useState<Goal | null>(null);
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState(""); // For editing
  const [deadline, setDeadline] = useState("");

  const openAddModal = () => {
    setModalMode("add");
    setCurrentGoal(null);
    setGoalName("");
    setTargetAmount("");
    setCurrentAmount("");
    setDeadline("");
    setIsModalOpen(true);
  };

  const openEditModal = (goal: Goal) => {
    setModalMode("edit");
    setCurrentGoal(goal);
    setGoalName(goal.name);
    setTargetAmount(String(goal.targetAmount));
    setCurrentAmount(String(goal.currentAmount));
    setDeadline(goal.deadline ? format(parseISO(goal.deadline), "yyyy-MM-dd") : "");
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const target = parseFloat(targetAmount);
    const current = modalMode === "edit" ? parseFloat(currentAmount) : 0;

    if (goalName && !isNaN(target) && target > 0 && (modalMode === "add" || !isNaN(current))) {
      if (modalMode === "add") {
        onAddGoal({
          name: goalName,
          targetAmount: target,
          deadline: deadline || undefined,
        });
      } else if (currentGoal) {
        onUpdateGoal({
          ...currentGoal,
          name: goalName,
          targetAmount: target,
          currentAmount: current, // Allow editing current amount
          deadline: deadline || undefined,
        });
      }
      setIsModalOpen(false);
    }
  };

  const handleDelete = () => {
    if (modalMode === "edit" && currentGoal) {
      if (window.confirm(`Are you sure you want to delete the goal "${currentGoal.name}"?`)) {
        onDeleteGoal(currentGoal.id);
        setIsModalOpen(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-100">Savings Goals</h2>
        <Button onClick={openAddModal}>
          <PlusCircle className="h-4 w-4 mr-2" /> Add New Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="pt-6">
            <p className="text-gray-300">You haven't set any savings goals yet. Click "Add New Goal" to start!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => {
            const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
            return (
              <Card key={goal.id} className="glass-card flex flex-col">
                <CardHeader>
                  <CardTitle className="flex justify-between items-center text-gray-100">
                    {goal.name}
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(goal)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Target: {formatCurrency(goal.targetAmount, currencyCode)}
                    {goal.deadline && ` by ${format(parseISO(goal.deadline), "MMM d, yyyy")}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow text-gray-200">
                  <div className="mb-2">
                    Current: {formatCurrency(goal.currentAmount, currencyCode)}
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
                    <div
                      className="bg-blue-500 h-2.5 rounded-full"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-400 flex justify-between">
                    <span>{progress.toFixed(1)}% Complete</span>
                    {goal.estimatedCompletionDate && (
                      <span>ETA: {format(parseISO(goal.estimatedCompletionDate), "MMM yyyy")}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Goal Modal - Ensure dark background with light text */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        {/* Apply dark background and light text color to the content area */}
        <DialogContent className="glass-card border border-gray-700 text-gray-100"> {/* Use glass-card style and light text */}
          <DialogHeader>
            {/* Title should also be light */}
            <DialogTitle className="text-gray-100">{modalMode === "edit" ? "Edit Goal" : "Add New Goal"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              {/* Ensure labels are light */}
              <Label htmlFor="goal-name" className="text-right text-gray-300">Name</Label>
              {/* Ensure input has dark bg and light text */}
              <Input id="goal-name" value={goalName} onChange={(e) => setGoalName(e.target.value)} className="col-span-3 bg-gray-800 border-gray-600 text-gray-100" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="target-amount" className="text-right text-gray-300">Target Amount</Label>
              <Input id="target-amount" type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} className="col-span-3 bg-gray-800 border-gray-600 text-gray-100" />
            </div>
            {modalMode === "edit" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="current-amount" className="text-right text-gray-300">Current Amount</Label>
                <Input id="current-amount" type="number" value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)} className="col-span-3 bg-gray-800 border-gray-600 text-gray-100" />
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deadline" className="text-right text-gray-300">Deadline (Optional)</Label>
              <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="col-span-3 bg-gray-800 border-gray-600 text-gray-100" />
            </div>
          </div>
          <DialogFooter className="justify-between">
            <div>
              {modalMode === "edit" && (
                <Button variant="destructive" onClick={handleDelete} className="mr-2">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete Goal
                </Button>
              )}
            </div>
            <div>
              <DialogClose asChild>
                <Button variant="outline" className="mr-2">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSave}>Save Goal</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GoalsView;

