import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Transaction } from "@/types";
import Papa from "papaparse";
// Corrected import paths if needed, assuming they are correct relative to this file
import { saveEncryptedToLocalStorage, loadDecryptedFromLocalStorage, saveToLocalStorage, loadFromLocalStorage } from "@/lib/secureStorage";
import { formatCurrency } from "@/App";

interface SettingsProps {
  onImportTransactions: (transactions: Omit<Transaction, "id">[]) => void;
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
}

const supportedCurrencies = ["CZK", "EUR", "USD"];

const Settings: React.FC<SettingsProps> = ({
  onImportTransactions,
  selectedCurrency,
  onCurrencyChange,
}) => {
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [mistralApiKey, setMistralApiKey] = useState("");
  const [selectedAiProvider, setSelectedAiProvider] = useState("openai");
  // Removed encryptionKey state as it's handled internally by secureStorage now
  // const [encryptionKey, setEncryptionKey] = useState("");
  // const [isKeySet, setIsKeySet] = useState(false);

  // Load keys and provider on mount
  useEffect(() => {
    // No need to handle encryption key manually here anymore
    setOpenaiApiKey(loadDecryptedFromLocalStorage("openaiApiKey") || "");
    setClaudeApiKey(loadDecryptedFromLocalStorage("claudeApiKey") || "");
    setMistralApiKey(loadDecryptedFromLocalStorage("mistralApiKey") || "");
    setSelectedAiProvider(loadFromLocalStorage("selectedAiProvider") || "openai");
  }, []);

  const handleSaveKeys = () => {
    // No need to check for encryption key
    saveEncryptedToLocalStorage("openaiApiKey", openaiApiKey);
    saveEncryptedToLocalStorage("claudeApiKey", claudeApiKey);
    saveEncryptedToLocalStorage("mistralApiKey", mistralApiKey);
    saveToLocalStorage("selectedAiProvider", selectedAiProvider);
    alert("API Keys and Provider saved securely.");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      let detectedEncoding = "utf-8"; // Declare encoding variable outside onload

      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Basic check for characters common in cp1250 but not standard utf-8
        // This detection is basic and might not be perfect
        if (text.includes("Datum zaúčtování;Valuta;Typ operace")) {
            detectedEncoding = "cp1250";
            console.log("Detected cp1250 encoding based on header.");
        } else if (/[\x80-\x9F]/.test(text.substring(0, 500))) {
            console.log("Detected potential non-UTF-8 characters, assuming cp1250.");
            detectedEncoding = "cp1250"; // Fallback assumption for non-header match
        } else {
            console.log("Assuming UTF-8 encoding.");
            detectedEncoding = "utf-8";
        }

        // Now parse with the detected encoding
        Papa.parse(file, {
          encoding: detectedEncoding,
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const transactions: Omit<Transaction, "id">[] = [];
            results.data.forEach((row: any) => {
              const date = row["Datum zaúčtování"];
              const description = row["Popis operace"];
              const amountStr = row["Částka"];
              const currency = row["Měna"];

              if (date && description && amountStr && currency === selectedCurrency) {
                const dateParts = date.split(".");
                const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
                // Corrected parsing: remove space, replace comma with dot
                const cleanedAmountStr = amountStr.replace(/[\s\u00A0]/g, "").replace(",", ".");
                const amount = parseFloat(cleanedAmountStr);

                if (!isNaN(amount)) {
                  transactions.push({
                    date: isoDate,
                    description: description,
                    amount: amount,
                    category: "Uncategorized",
                  });
                } else {
                  console.warn("Skipping row due to invalid amount:", row);
                }
              } else {
                 console.warn("Skipping row due to missing data or currency mismatch:", row);
              }
            });
            onImportTransactions(transactions);
            alert(`Imported ${transactions.length} transactions.`);
          },
          error: (error: any) => {
            console.error("Error parsing CSV:", error);
            alert(`Error parsing CSV: ${error.message}`);
          },
        });
      };
      // Use the detectedEncoding variable here
      reader.readAsText(file, detectedEncoding);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-100">Settings</h2>

      {/* Currency Selection */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-gray-100">Currency</CardTitle>
          <CardDescription className="text-gray-300">Select your primary currency.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedCurrency} onValueChange={onCurrencyChange}>
            <SelectTrigger className="w-[180px] bg-gray-800 border-gray-600 text-gray-100">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600 text-gray-100">
              {supportedCurrencies.map(code => (
                <SelectItem key={code} value={code} className="hover:bg-gray-700">{code} ({formatCurrency(1, code)})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* API Key Management */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-gray-100">AI Configuration</CardTitle>
          <CardDescription className="text-gray-300">Manage API keys for AI features (stored encrypted).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="ai-provider" className="text-gray-200">Select AI Provider</Label>
            <Select value={selectedAiProvider} onValueChange={setSelectedAiProvider}>
              <SelectTrigger id="ai-provider" className="w-full bg-gray-800 border-gray-600 text-gray-100">
                <SelectValue placeholder="Select AI Provider" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600 text-gray-100">
                <SelectItem value="openai" className="hover:bg-gray-700">OpenAI</SelectItem>
                <SelectItem value="claude" className="hover:bg-gray-700">Anthropic (Claude)</SelectItem>
                <SelectItem value="mistral" className="hover:bg-gray-700">Mistral AI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="openai-key" className="text-gray-200">OpenAI API Key</Label>
            <Input
              id="openai-key"
              type="password"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="Enter your OpenAI API Key"
              className="bg-gray-800 border-gray-600 text-gray-100"
            />
          </div>
          <div>
            <Label htmlFor="claude-key" className="text-gray-200">Claude API Key</Label>
            <Input
              id="claude-key"
              type="password"
              value={claudeApiKey}
              onChange={(e) => setClaudeApiKey(e.target.value)}
              placeholder="Enter your Anthropic Claude API Key"
              className="bg-gray-800 border-gray-600 text-gray-100"
            />
          </div>
          <div>
            <Label htmlFor="mistral-key" className="text-gray-200">Mistral API Key</Label>
            <Input
              id="mistral-key"
              type="password"
              value={mistralApiKey}
              onChange={(e) => setMistralApiKey(e.target.value)}
              placeholder="Enter your Mistral AI API Key"
              className="bg-gray-800 border-gray-600 text-gray-100"
            />
          </div>
          <Button onClick={handleSaveKeys}>Save API Keys & Provider</Button>
        </CardContent>
      </Card>

      {/* CSV Import */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-gray-100">Import Data</CardTitle>
          <CardDescription className="text-gray-300">Import transactions from a CSV file (ensure format matches your bank export, using {selectedCurrency} currency).</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="csv-import" className="text-gray-200">Upload CSV File</Label>
          <Input id="csv-import" type="file" accept=".csv" onChange={handleFileChange} className="mt-2 bg-gray-800 border-gray-600 text-gray-100 file:text-gray-300 file:bg-gray-700 file:border-gray-600" />
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;

