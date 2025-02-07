// components/Providers.tsx
"use client";

import { ThemeProvider } from "next-themes";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="relative min-h-screen">
        {/* Legend Dialog – using shadcn default styling */}
        <div className="absolute top-4 right-4 z-50">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" className="p-2">
                <span className="text-2xl">?</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-gray-800 text-foreground border shadow-lg">
              <DialogHeader>
                <DialogTitle>Game Legend</DialogTitle>
                <DialogDescription asChild>
                  <div>
                    <div className="mb-2">
                      <strong>Kings Cup Multiplayer Game</strong> is a drinking
                      game with these key elements:
                    </div>
                    <ul className="list-disc ml-5 space-y-1">
                      <li>
                        <strong>Player:</strong> A normal participant who draws
                        cards and follows their instructions.
                      </li>
                      <li>
                        <strong>Referee:</strong> A designated player who
                        generates custom prompts (instead of drinking) and marks
                        violations.
                      </li>
                      <li>
                        <strong>Observer:</strong> Someone watching the game
                        without participating.
                      </li>
                      <li>
                        <strong>Penalty Points:</strong> Points assigned for
                        rule violations. At the end of the game, each point
                        equals one drink.
                      </li>
                      <li>
                        <strong>Game Rules:</strong> Cards trigger various
                        actions—from starting a waterfall to assigning penalties
                        and creating new rules.
                      </li>
                    </ul>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogClose asChild>
                <Button variant="outline" className="mt-4">
                  Close
                </Button>
              </DialogClose>
            </DialogContent>
          </Dialog>
        </div>
        {children}
      </div>
    </ThemeProvider>
  );
}
