import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, Trophy, Clock, Star, X } from 'lucide-react';

interface ScoreEntry {
  score: number;
  date: string;
}

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [activeMole, setActiveMole] = useState<{ index: number; q: string; ans: number } | null>(null);
  const [options, setOptions] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);

  const moleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scoreRef = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem('whack-a-mole-leaderboard');
    if (saved) {
      try {
        setLeaderboard(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveScore = (newScore: number) => {
    const newEntry = { score: newScore, date: new Date().toLocaleDateString() };
    setLeaderboard(prev => {
      const newLeaderboard = [...prev, newEntry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      localStorage.setItem('whack-a-mole-leaderboard', JSON.stringify(newLeaderboard));
      return newLeaderboard;
    });
  };

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playSound = useCallback((type: 'correct' | 'wrong' | 'gameover') => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const t = ctx.currentTime;

    if (type === 'correct') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (type === 'wrong') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    } else if (type === 'gameover') {
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + i * 0.15);
        gain.gain.setValueAtTime(0, t);
        gain.gain.setValueAtTime(0.3, t + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.15 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + i * 0.15);
        osc.stop(t + i * 0.15 + 0.4);
      });
    }
  }, []);

  const spawnMole = useCallback(() => {
    if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
    setFeedback(null);

    const index = Math.floor(Math.random() * 6);
    const num1 = Math.floor(Math.random() * 8) + 2; // 2-9
    const num2 = Math.floor(Math.random() * 8) + 2; // 2-9
    const ans = num1 * num2;
    
    const opts = new Set<number>();
    opts.add(ans);
    while (opts.size < 3) {
      const offset = Math.floor(Math.random() * 10) + 1;
      const sign = Math.random() > 0.5 ? 1 : -1;
      const wrongAns = ans + offset * sign;
      if (wrongAns > 0 && wrongAns !== ans) opts.add(wrongAns);
    }
    const shuffledOpts = Array.from(opts).sort(() => Math.random() - 0.5);

    setActiveMole({ index, q: `${num1} × ${num2}`, ans });
    setOptions(shuffledOpts);

    const stayTime = 2500;
    moleTimerRef.current = setTimeout(() => {
      setActiveMole(null);
      setOptions([]);
      moleTimerRef.current = setTimeout(spawnMole, Math.random() * 1000 + 500);
    }, stayTime);
  }, []);

  const startGame = () => {
    initAudio();
    setIsPlaying(true);
    setTimeLeft(30);
    setScore(0);
    scoreRef.current = 0;
    setShowModal(false);
    setFeedback(null);
    spawnMole();
    
    gameTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const endGame = () => {
    setIsPlaying(false);
    setActiveMole(null);
    setOptions([]);
    setShowModal(true);
    playSound('gameover');
    saveScore(scoreRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
  };

  const handleAnswer = (selectedAns: number) => {
    if (!activeMole || !isPlaying) return;

    if (selectedAns === activeMole.ans) {
      playSound('correct');
      setScore((s) => {
        const newScore = s + 10;
        scoreRef.current = newScore;
        return newScore;
      });
      setFeedback('correct');
      if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
      setActiveMole(null);
      setOptions([]);
      setTimeout(() => setFeedback(null), 300);
      moleTimerRef.current = setTimeout(spawnMole, 500);
    } else {
      playSound('wrong');
      setScore((s) => {
        const newScore = s - 5;
        scoreRef.current = newScore;
        return newScore;
      });
      setFeedback('wrong');
      setTimeout(() => setFeedback(null), 300);
    }
  };

  useEffect(() => {
    return () => {
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
    };
  }, []);

  return (
    <div className="h-[100dvh] bg-[#52b755] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#6ee772] to-[#3a8b3c] flex flex-col items-center justify-center p-2 md:p-4 font-sans overflow-hidden">
      
      <div className="mb-2 md:mb-4 text-center shrink-0">
        <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.3)] tracking-wide">
          打地鼠 <span className="text-yellow-300">九九乘法</span>
        </h1>
      </div>

      <div className={`max-w-3xl w-full flex flex-col items-center gap-4 md:gap-6 p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] transition-all duration-300 shrink min-h-0 ${
        feedback === 'correct' ? 'bg-green-400/40 ring-8 ring-green-300 scale-[1.02]' : 
        feedback === 'wrong' ? 'bg-red-500/40 ring-8 ring-red-500 scale-[0.98]' : 
        'bg-black/10 ring-4 ring-black/5'
      }`}>
        
        {/* Header Stats */}
        <div className="flex justify-between items-center w-full bg-green-800/60 p-3 md:p-4 rounded-2xl text-white font-bold text-xl md:text-2xl shadow-lg backdrop-blur-sm border border-green-500/30 shrink-0">
          <div className="flex items-center gap-2 md:gap-3 bg-black/20 px-3 py-1.5 md:px-4 md:py-2 rounded-xl">
            <Clock className={timeLeft <= 5 && isPlaying ? 'text-red-400 animate-pulse' : 'text-blue-300'} size={24} />
            <span className={timeLeft <= 5 && isPlaying ? 'text-red-400 animate-pulse' : ''}>
              00:{timeLeft.toString().padStart(2, '0')}
            </span>
          </div>
          <div className="flex items-center gap-2 md:gap-3 bg-black/20 px-3 py-1.5 md:px-4 md:py-2 rounded-xl">
            <Star className="text-yellow-400" size={24} fill="currentColor" />
            <span className="text-yellow-300">{score}</span>
          </div>
        </div>

        {/* Game Board */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 w-full place-items-center py-2 shrink min-h-0">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full bg-[#3E2723] shadow-[inset_0_-10px_20px_rgba(0,0,0,0.8)] flex items-end justify-center overflow-hidden border-4 border-[#2E1D16] shrink-0">
              <AnimatePresence>
                {activeMole?.index === i && (
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: "10%" }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="absolute bottom-0 w-[75%] h-[85%] bg-[#8B4513] rounded-t-full flex flex-col items-center justify-start pt-2 md:pt-4 border-4 border-[#5C3A21] shadow-lg"
                  >
                    <div className="flex gap-2 md:gap-3 mb-1 md:mb-2">
                      <div className="w-2 h-2 md:w-3 md:h-3 bg-black rounded-full"></div>
                      <div className="w-2 h-2 md:w-3 md:h-3 bg-black rounded-full"></div>
                    </div>
                    <div className="w-4 h-2 md:w-5 md:h-3 bg-pink-400 rounded-full mb-1 md:mb-3"></div>
                    <div className="bg-white/95 px-2 md:px-3 py-0.5 md:py-1.5 rounded-xl text-[#5C3A21] font-black text-sm sm:text-base md:text-xl shadow-sm whitespace-nowrap border-2 border-[#5C3A21]">
                      {activeMole.q}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Controls / Options */}
        <div className="flex gap-3 md:gap-6 w-full justify-center mt-2 h-16 md:h-20 shrink-0">
          {isPlaying ? (
            options.length > 0 ? (
              options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt)}
                  className="flex-1 max-w-[140px] bg-white text-green-700 font-black text-2xl md:text-4xl rounded-full shadow-[0_6px_0_rgb(21,128,61)] md:shadow-[0_8px_0_rgb(21,128,61)] hover:scale-105 hover:shadow-[0_3px_0_rgb(21,128,61)] md:hover:shadow-[0_4px_0_rgb(21,128,61)] hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all border-4 border-green-600"
                >
                  {opt}
                </button>
              ))
            ) : (
              [1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex-1 max-w-[140px] bg-white/40 text-green-800/30 font-black text-2xl md:text-4xl rounded-full shadow-[0_6px_0_rgba(21,128,61,0.3)] md:shadow-[0_8px_0_rgba(21,128,61,0.3)] border-4 border-green-600/30 flex items-center justify-center"
                >
                  ?
                </div>
              ))
            )
          ) : (
            <div className="flex gap-3 md:gap-4 w-full max-w-md">
              <button
                onClick={startGame}
                className="flex-1 py-2 md:py-4 bg-yellow-400 text-yellow-900 font-black text-2xl md:text-3xl rounded-full shadow-[0_6px_0_rgb(161,98,7)] md:shadow-[0_8px_0_rgb(161,98,7)] hover:scale-105 hover:shadow-[0_3px_0_rgb(161,98,7)] md:hover:shadow-[0_4px_0_rgb(161,98,7)] hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all flex items-center justify-center gap-2 md:gap-4 border-4 border-yellow-500"
              >
                <Play fill="currentColor" className="w-6 h-6 md:w-8 md:h-8" />
                開始遊戲
              </button>
              <button
                onClick={() => setShowLeaderboard(true)}
                className="w-16 md:w-20 bg-blue-400 text-blue-900 font-black rounded-full shadow-[0_6px_0_rgb(30,58,138)] md:shadow-[0_8px_0_rgb(30,58,138)] hover:scale-105 hover:shadow-[0_3px_0_rgb(30,58,138)] md:hover:shadow-[0_4px_0_rgb(30,58,138)] hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all flex items-center justify-center border-4 border-blue-500 shrink-0"
                aria-label="排行榜"
              >
                <Trophy fill="currentColor" className="w-6 h-6 md:w-8 md:h-8" />
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Game Over Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 max-w-sm md:max-w-md w-full flex flex-col items-center text-center shadow-2xl border-8 border-green-500 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-24 md:h-32 bg-green-500/10 rounded-t-[1.5rem] md:rounded-t-[2.5rem]"></div>
              <Trophy className="text-yellow-400 w-20 h-20 md:w-28 md:h-28 mb-4 md:mb-6 relative z-10 drop-shadow-lg" fill="currentColor" />
              <h2 className="text-3xl md:text-5xl font-black text-green-800 mb-2 relative z-10">遊戲結束!</h2>
              <p className="text-gray-500 font-bold text-lg md:text-xl mb-4 md:mb-6 relative z-10">你的最終分數</p>
              <div className="text-6xl md:text-7xl font-black text-yellow-500 mb-8 md:mb-10 drop-shadow-md relative z-10">
                {score}
              </div>
              
              <div className="flex flex-col gap-3 w-full relative z-10">
                <button
                  onClick={startGame}
                  className="w-full py-4 bg-green-500 text-white font-black text-xl md:text-2xl rounded-full shadow-[0_6px_0_rgb(21,128,61)] hover:scale-105 hover:shadow-[0_3px_0_rgb(21,128,61)] hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all flex items-center justify-center gap-3"
                >
                  <RotateCcw strokeWidth={3} size={28} />
                  再玩一次
                </button>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setShowLeaderboard(true);
                  }}
                  className="w-full py-3 bg-blue-100 text-blue-700 font-black text-lg md:text-xl rounded-full shadow-[0_4px_0_rgb(191,219,254)] hover:scale-105 hover:shadow-[0_2px_0_rgb(191,219,254)] hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all flex items-center justify-center gap-2 border-2 border-blue-200"
                >
                  <Trophy size={24} />
                  查看排行榜
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              className="bg-white rounded-[2rem] p-6 md:p-8 max-w-sm w-full flex flex-col items-center shadow-2xl border-8 border-blue-500 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-24 bg-blue-500/10 rounded-t-[1.5rem]"></div>
              <button 
                onClick={() => setShowLeaderboard(false)}
                className="absolute top-4 right-4 text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded-full transition-colors z-20"
              >
                <X size={28} strokeWidth={3} />
              </button>
              
              <Trophy className="text-blue-500 w-16 h-16 mb-4 relative z-10 drop-shadow-md" fill="currentColor" />
              <h2 className="text-3xl font-black text-blue-800 mb-6 relative z-10">排行榜</h2>
              
              <div className="w-full flex flex-col gap-3 mb-8 relative z-10">
                {leaderboard.length > 0 ? (
                  leaderboard.map((entry, i) => (
                    <div key={i} className="flex justify-between items-center bg-blue-50 p-3 rounded-xl border-2 border-blue-100">
                      <div className="flex items-center gap-3">
                        <span className={`font-black text-xl w-6 text-center ${i === 0 ? 'text-yellow-500 drop-shadow-sm' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-blue-300'}`}>
                          #{i + 1}
                        </span>
                        <span className="text-blue-900 font-bold text-lg">{entry.score} 分</span>
                      </div>
                      <span className="text-blue-400 text-sm font-medium">{entry.date}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 font-medium py-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    尚無紀錄，趕快來挑戰！
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowLeaderboard(false)}
                className="w-full py-3 bg-blue-500 text-white font-black text-xl rounded-full shadow-[0_6px_0_rgb(29,78,216)] hover:scale-105 hover:shadow-[0_3px_0_rgb(29,78,216)] hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all relative z-10"
              >
                關閉
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

