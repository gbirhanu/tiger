import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDate } from '@/lib/timezone';
import { Button } from '@/components/ui/button';

interface Note {
  id: number;
  title: string;
  content: string | null;
  pinned: boolean;
  created_at: number;
}

const StickyNoteWall = ({ notes, currentNoteIndex, setCurrentNoteIndex }: { notes: Note[], currentNoteIndex: number, setCurrentNoteIndex: (index: number) => void }) => {
  const pinnedNotes = notes.filter(note => note.pinned);
  const [isFlipping, setIsFlipping] = useState(false);

  const flipDurationMilliseconds = 900;

  const handleFlip = () => {
    if (isFlipping || pinnedNotes.length <= 1) return;
    setIsFlipping(true);
    setTimeout(() => {
      const nextIndex = (currentNoteIndex + 1) % pinnedNotes.length;
      setCurrentNoteIndex(nextIndex);
      setIsFlipping(false);
    }, flipDurationMilliseconds);
  };

  const nextIndex = (currentNoteIndex + 1) % pinnedNotes.length;

  // Define a consistent base shadow
  const baseShadow = "0 1px 3px rgba(0,0,0,0.08)"; // Slightly softer base shadow
  const flipShadow = "0 6px 15px rgba(0,0,0,0.12)"; // Less intense shadow during flip

  return (
    <Card className="relative overflow-visible">
      <CardContent className="p-0 h-[300px]">
        <div className="absolute inset-0 flex items-center justify-center perspective-1000">
          {Array.isArray(notes) && pinnedNotes.length > 0 ? (
            <div className="relative w-full max-w-md h-[280px]">
              {/* Container */}
              <div className="absolute top-0 left-0 w-full h-full">
                {/* Background stack effect */}
                {/* ... (stack effect code remains the same) ... */}
                 {Array.from({ length: Math.min(3, pinnedNotes.length) }).map((_, idx) => {
                   if (idx === 0) return null;
                   return (
                     <div
                       key={`paper-stack-${idx}`}
                       className="absolute notebook-texture rounded-sm w-full h-full"
                       style={{
                         transform: `rotate(${idx % 2 === 0 ? -0.5 : 0.5}deg) translateY(${idx * 3}px)`,
                         zIndex: 5 - idx,
                         opacity: 1 - (idx * 0.1),
                         boxShadow: '0 2px 3px rgba(0,0,0,0.1)',
                       }}
                     >
                       <div className="absolute bottom-0 left-0 w-full h-[85%] bg-transparent" />
                     </div>
                   );
                 })}

                {/* Next note underneath (ensure it uses the base shadow or no shadow if preferred) */}
                {pinnedNotes.length > 1 && (
                  <div
                    className="absolute notebook-texture rounded-sm w-full h-full"
                    style={{
                      zIndex: 20,
                      transform: 'rotate(0deg)',
                      boxShadow: baseShadow // Apply consistent base shadow
                    }}
                  >
                    {/* Content... */}
                     {/* Notebook holes for next note */}
                     <div className="absolute top-0 left-0 w-full h-8 bg-[#f8f8f8] dark:bg-[#282619] border-b border-[#e5e5e5] dark:border-[#444] flex items-center justify-around px-12">
                       {Array.from({ length: 5 }).map((_, i) => (
                         <div key={i} className="w-3 h-3 rounded-full bg-[#d4d4d4] dark:bg-[#555] shadow-inner"></div>
                       ))}
                     </div>
                     <div className="p-6 pt-12 h-full flex flex-col overflow-hidden">
                       <div className="flex items-center justify-between mb-4">
                         <h3 className="text-xl font-semibold text-blue-900 dark:text-amber-100 font-notebook">
                           {pinnedNotes[nextIndex]?.title || ""}
                         </h3>
                         <span className="text-sm text-blue-600/70 dark:text-amber-200/70 italic font-notebook">
                           {formatDate(new Date((pinnedNotes[nextIndex]?.created_at || 0) * 1000), "MMM d")}
                         </span>
                       </div>
                       <div className="flex-1 overflow-hidden relative">
                         <p className="text-slate-800 dark:text-amber-100 whitespace-pre-wrap font-notebook leading-relaxed pr-2 line-clamp-8 text-[17px] tracking-wide" style={{ textShadow: "0.2px 0.2px 0px rgba(0,0,0,0.05)" }}>
                           {pinnedNotes[nextIndex]?.content || ""}
                         </p>
                         {/* Lines */}
                         <div className="absolute inset-0 pointer-events-none">
                           {Array.from({ length: 10 }).map((_, i) => ( <div key={i} className="absolute w-full h-[1px] bg-blue-100 dark:bg-amber-950/30" style={{ top: `${(i + 1) * 28}px` }} ></div> ))}
                           <div className="absolute left-[30px] top-0 w-[1px] h-full bg-red-300/30 dark:bg-amber-800/20"></div>
                         </div>
                       </div>
                       <div className="mt-auto pt-4 flex justify-between text-xs border-t border-blue-100/40 dark:border-amber-800/30">
                         <div className="flex items-center text-blue-600/70 dark:text-amber-200/70">
                           <BookOpen className="h-3 w-3 mr-1" />
                           <span>Note {nextIndex + 1} of {pinnedNotes.length}</span>
                         </div>
                       </div>
                     </div>
                  </div>
                )}


                {/* Current page with flip animation - ONLY this page animates */}
                {/* ----- START OF UPDATED SECTION ----- */}
                <motion.div
                  key={currentNoteIndex}
                  // Removed Tailwind shadow class, controlling it via motion props now
                  className="absolute notebook-texture rounded-sm w-full h-full cursor-pointer"
                  style={{
                    transformStyle: "preserve-3d",
                    backfaceVisibility: "hidden",
                    transformOrigin: "top center", // Pivot around the top edge center
                    pointerEvents: isFlipping ? "none" : "auto",
                    zIndex: 30,
                    // Ensure consistent base shadow matches the static note
                    boxShadow: baseShadow,
                    // Add a tiny translateZ to help with layering consistency
                    transform: "translateZ(1px)"
                  }}
                  initial={{
                    rotateX: 0,
                    opacity: 1,
                    // boxShadow: baseShadow, // Set initial shadow via style or here
                  }}
                  animate={{
                    rotateX: isFlipping ? 180 : 0,
                    opacity: isFlipping ? 0 : 1,
                    // Animate shadow smoothly between base and flip states
                    boxShadow: isFlipping ? flipShadow : baseShadow,
                    // Keep the tiny translateZ during animation
                    transform: isFlipping ? "translateZ(1px) rotateX(180deg)" : "translateZ(1px) rotateX(0deg)",
                  }}
                  transition={{
                    type: "tween",
                    duration: flipDurationMilliseconds / 1000,
                    ease: "easeInOut",
                    // Specify transitions for properties individually if needed,
                    // especially if opacity/shadow should fade faster/slower than rotation.
                    // Example:
                    // rotateX: { type: "tween", duration: flipDurationMilliseconds / 1000, ease: "easeInOut" },
                    // opacity: { type: "tween", duration: (flipDurationMilliseconds * 0.8) / 1000, ease: "easeOut" }, // Fade out faster
                    // boxShadow: { type: "tween", duration: flipDurationMilliseconds / 1000, ease: "easeInOut" },
                  }}
                  onClick={handleFlip}
                >
                  {/* ... (current page content remains the same) ... */}
                  {/* Notebook holes for current page */}
                   <div className="absolute top-0 left-0 w-full h-8 bg-[#f8f8f8] dark:bg-[#282619] border-b border-[#e5e5e5] dark:border-[#444] flex items-center justify-around px-12">
                     {Array.from({ length: 5 }).map((_, i) => (
                       <div key={i} className="w-3 h-3 rounded-full bg-[#d4d4d4] dark:bg-[#555] shadow-inner"></div>
                     ))}
                   </div>
                   <div className="p-6 pt-12 h-full flex flex-col overflow-hidden">
                     <div className="flex items-center justify-between mb-4">
                       <h3 className="text-xl font-semibold text-blue-900 dark:text-amber-100 font-notebook">
                         {pinnedNotes[currentNoteIndex]?.title || ""}
                       </h3>
                       <span className="text-sm text-blue-600/70 dark:text-amber-200/70 italic font-notebook">
                         {formatDate(new Date((pinnedNotes[currentNoteIndex]?.created_at || 0) * 1000), "MMM d")}
                       </span>
                     </div>
                     <div className="flex-1 overflow-hidden relative">
                       <p className="text-slate-800 dark:text-amber-100 whitespace-pre-wrap font-notebook leading-relaxed pr-2 line-clamp-8 text-[17px] tracking-wide" style={{ textShadow: "0.2px 0.2px 0px rgba(0,0,0,0.05)" }}>
                         {pinnedNotes[currentNoteIndex]?.content || ""}
                       </p>
                       {/* Lines */}
                       <div className="absolute inset-0 pointer-events-none">
                           {Array.from({ length: 10 }).map((_, i) => ( <div key={i} className="absolute w-full h-[1px] bg-blue-100 dark:bg-amber-950/30" style={{ top: `${(i + 1) * 28}px` }} ></div> ))}
                           <div className="absolute left-[30px] top-0 w-[1px] h-full bg-red-300/30 dark:bg-amber-800/20"></div>
                       </div>
                     </div>
                     <div className="mt-auto pt-4 flex justify-between text-xs border-t border-blue-100/40 dark:border-amber-800/30">
                       <div className="flex items-center text-blue-600/70 dark:text-amber-200/70">
                         <BookOpen className="h-3 w-3 mr-1" />
                         <span>Note {currentNoteIndex + 1} of {pinnedNotes.length}</span>
                       </div>
                       <span className="text-blue-600/70 dark:text-amber-200/70 font-medium underline">
                         tap to flip
                       </span>
                     </div>
                   </div>
                </motion.div>
                {/* ----- END OF UPDATED SECTION ----- */}

              </div>
            </div>
          ) : (
            // ... No Pinned Notes content ... (unchanged)
             <div className="p-8 text-center bg-blue-50/50 dark:bg-blue-900/10 rounded-sm shadow-sm border border-blue-100/50 dark:border-blue-800/20 w-full max-w-sm">
               <BookOpen className="h-16 w-16 mx-auto mb-4 text-blue-300 dark:text-blue-700" />
               <p className="text-blue-600 dark:text-blue-400 font-medium">No pinned notes</p>
               <p className="text-blue-500/70 dark:text-blue-500/70 mt-2 text-sm">
                 Add a note and pin it to see it here
               </p>
               <Button
                 variant="ghost"
                 size="sm"
                 className="mt-4 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                 onClick={() => {
                   localStorage.setItem('selectedNav', 'Notes');
                   window.location.reload();
                 }}
               >
                 Go to Notes
               </Button>
             </div>
          )}
        </div>
      </CardContent>

      {/* CSS Styles */}
      {/* ... (CSS styles remain the same) ... */}
       <style>
         {`
         .font-notebook {
           font-family: 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive, sans-serif;
           letter-spacing: 0.3px;
           line-height: 1.5;
         }
         .perspective-1000 {
           perspective: 1000px;
         }
         .notebook-texture {
           background-color: #fffbe5;
           background-image: linear-gradient(0deg, rgba(220, 235, 255, 0.1) 1px, transparent 1px);
           background-size: 100% 28px;
           /* Shadow handled by motion component now */
           margin: 0 auto;
         }
         .dark .notebook-texture {
           background-color: #403828;
           background-image: linear-gradient(0deg, rgba(80, 60, 40, 0.15) 1px, transparent 1px);
           background-size: 100% 28px;
           margin: 0 auto;
         }
         `}
       </style>
    </Card>
  );
};

export default StickyNoteWall;





