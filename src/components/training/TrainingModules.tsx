"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  getQuizForCourse,
  TRAINING_PASS_CORRECT,
  TRAINING_QUIZ_LENGTH,
  type QuizQuestion,
} from "@/data/training-quizzes";

interface TrainingCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  duration_minutes: number;
  lessons: number;
  badge: string;
  badge_name: string;
  points: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  completed?: boolean;
  progress?: number;
  thumbnail?: string;
  elite_required?: boolean;
}

const CATEGORIES = [
  { id: "all", label: "All Courses", icon: "📚" },
  { id: "safety", label: "Safety & Security", icon: "🛡️" },
  { id: "medical", label: "Medical", icon: "🏥" },
  { id: "communication", label: "Communication", icon: "💬" },
  { id: "legal", label: "Legal & Compliance", icon: "⚖️" },
  { id: "specialist", label: "Specialist", icon: "⭐" },
];

const COURSES: TrainingCourse[] = [
  {
    id: "ct-basics",
    title: "Counter-Terrorism Basics",
    description: "Learn to identify suspicious behavior and respond to potential threats. ACT certified content.",
    category: "safety",
    duration_minutes: 8,
    lessons: 4,
    badge: "🛡️",
    badge_name: "CT Aware",
    points: 50,
    difficulty: "beginner",
  },
  {
    id: "first-aid-refresh",
    title: "First Aid Refresher",
    description: "Quick refresh on CPR, recovery position, and handling common injuries at venues.",
    category: "medical",
    duration_minutes: 10,
    lessons: 5,
    badge: "🏥",
    badge_name: "First Responder",
    points: 40,
    difficulty: "beginner",
  },
  {
    id: "conflict-deesc",
    title: "Conflict De-escalation",
    description: "Techniques to calm aggressive situations without physical intervention.",
    category: "communication",
    duration_minutes: 12,
    lessons: 6,
    badge: "🤝",
    badge_name: "Peacekeeper",
    points: 60,
    difficulty: "intermediate",
  },
  {
    id: "drug-awareness",
    title: "Drug Awareness",
    description: "Identify signs of drug use and understand common substances in nightlife settings.",
    category: "safety",
    duration_minutes: 7,
    lessons: 4,
    badge: "💊",
    badge_name: "Vigilant",
    points: 45,
    difficulty: "beginner",
  },
  {
    id: "crowd-management",
    title: "Crowd Management",
    description: "Handle large crowds safely, manage queues, and prevent crushes at events.",
    category: "safety",
    duration_minutes: 15,
    lessons: 7,
    badge: "👥",
    badge_name: "Crowd Controller",
    points: 75,
    difficulty: "intermediate",
  },
  {
    id: "search-procedures",
    title: "Search Procedures",
    description: "Legal and effective search techniques for door supervisors.",
    category: "legal",
    duration_minutes: 10,
    lessons: 5,
    badge: "🔍",
    badge_name: "Search Pro",
    points: 55,
    difficulty: "intermediate",
  },
  {
    id: "mental-health",
    title: "Mental Health Awareness",
    description: "Recognize and appropriately respond to mental health crises.",
    category: "medical",
    duration_minutes: 12,
    lessons: 6,
    badge: "🧠",
    badge_name: "Mindful Guard",
    points: 65,
    difficulty: "intermediate",
  },
  {
    id: "vip-protection",
    title: "VIP & Close Protection",
    description: "Advanced techniques for protecting high-profile individuals.",
    category: "specialist",
    duration_minutes: 20,
    lessons: 10,
    badge: "⭐",
    badge_name: "Elite Protector",
    points: 100,
    difficulty: "advanced",
    elite_required: true,
  },
  {
    id: "licensing-law",
    title: "Licensing Law Essentials",
    description: "Understanding UK licensing law and your responsibilities as a door supervisor.",
    category: "legal",
    duration_minutes: 8,
    lessons: 4,
    badge: "⚖️",
    badge_name: "Law Expert",
    points: 50,
    difficulty: "beginner",
  },
  {
    id: "report-writing",
    title: "Incident Report Writing",
    description: "Write clear, accurate incident reports that hold up in court.",
    category: "legal",
    duration_minutes: 6,
    lessons: 3,
    badge: "📝",
    badge_name: "Reporter",
    points: 35,
    difficulty: "beginner",
  },
];

export function TrainingModules() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState<TrainingCourse | null>(null);
  const [courseState, setCourseState] = useState<"intro" | "lesson" | "quiz" | "complete">("intro");
  const [currentLesson, setCurrentLesson] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [sessionCompletedIds, setSessionCompletedIds] = useState<Set<string>>(() => new Set());
  const [dbCompletedIds, setDbCompletedIds] = useState<Set<string>>(() => new Set());

  const activeQuiz: QuizQuestion[] | null = useMemo(
    () => (selectedCourse ? getQuizForCourse(selectedCourse.id) : null),
    [selectedCourse?.id]
  );

  const sessionPoints = useMemo(() => {
    let pts = 0;
    for (const c of COURSES) {
      if (sessionCompletedIds.has(c.id)) pts += c.points;
    }
    return pts;
  }, [sessionCompletedIds]);

  useEffect(() => {
    const loadCompletions = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: personnel } = await supabase.from("personnel").select("id").eq("user_id", user.id).single();
      if (!personnel?.id) return;
      const { data: rows } = await supabase
        .from("training_completions")
        .select("course_id")
        .eq("personnel_id", personnel.id);
      setDbCompletedIds(new Set((rows || []).map((r: any) => r.course_id as string)));
    };
    loadCompletions();
  }, []);

  useEffect(() => {
    if (courseState !== "complete" || !selectedCourse || !activeQuiz?.length) return;
    if (correctAnswers < TRAINING_PASS_CORRECT) return;
    setSessionCompletedIds((prev) => {
      if (prev.has(selectedCourse.id)) return prev;
      const next = new Set(prev);
      next.add(selectedCourse.id);
      return next;
    });
  }, [courseState, selectedCourse?.id, correctAnswers, activeQuiz?.length]);

  useEffect(() => {
    const persistPass = async () => {
      if (courseState !== "complete" || !selectedCourse || !activeQuiz?.length) return;
      if (correctAnswers < TRAINING_PASS_CORRECT) return;
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: personnel } = await supabase.from("personnel").select("id").eq("user_id", user.id).single();
      if (!personnel?.id) return;
      await supabase.rpc("apply_training_completion", {
        p_personnel_id: personnel.id,
        p_course_id: selectedCourse.id,
        p_badge_name: selectedCourse.badge_name,
        p_points_earned: selectedCourse.points,
        p_quiz_score: Math.round((correctAnswers / Math.max(activeQuiz.length, 1)) * 100),
      });
      setDbCompletedIds((prev) => {
        const next = new Set(prev);
        next.add(selectedCourse.id);
        return next;
      });
    };
    persistPass();
  }, [courseState, selectedCourse?.id, correctAnswers, activeQuiz?.length]);

  const filteredCourses = selectedCategory === "all" 
    ? COURSES 
    : COURSES.filter(c => c.category === selectedCategory);

  const startCourse = (course: TrainingCourse) => {
    setSelectedCourse(course);
    setCourseState("intro");
    setCurrentLesson(0);
    setQuizIndex(0);
    setCorrectAnswers(0);
  };

  const handleAnswerSelect = (index: number) => {
    if (selectedAnswer !== null || !activeQuiz?.length) return;
    const q = activeQuiz[quizIndex];
    if (!q) return;
    setSelectedAnswer(index);
    setShowExplanation(true);
    if (index === q.correct_index) {
      setCorrectAnswers((prev) => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (!activeQuiz?.length) return;
    if (quizIndex < activeQuiz.length - 1) {
      setQuizIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setCourseState("complete");
    }
  };

  const retryQuiz = () => {
    setQuizIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setCorrectAnswers(0);
    setCourseState("quiz");
  };

  const closeCourse = () => {
    setSelectedCourse(null);
    setCourseState("intro");
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case "beginner": return "bg-green-500/20 text-green-400";
      case "intermediate": return "bg-amber-500/20 text-amber-400";
      case "advanced": return "bg-red-500/20 text-red-400";
      default: return "bg-zinc-500/20 text-zinc-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Training Academy</h1>
        <p className="text-zinc-400">
          Complete micro-courses to earn badges, unlock higher pay rates, and become Shield Elite.
        </p>
      </div>

      {/* Progress Banner */}
      <div className="glass rounded-xl border border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎓</span>
            <div>
              <p className="text-sm font-medium text-white">Your Progress</p>
              <p className="text-xs text-zinc-500">
                {new Set([...Array.from(sessionCompletedIds), ...Array.from(dbCompletedIds)]).size} of {COURSES.length} courses completed
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-white">{sessionPoints} pts</p>
            <p className="text-xs text-zinc-500">Earned this session</p>
          </div>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
            style={{
              width: `${COURSES.length ? Math.min(100, (new Set([...Array.from(sessionCompletedIds), ...Array.from(dbCompletedIds)]).size / COURSES.length) * 100) : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? "bg-blue-600 text-white"
                : "bg-white/5 text-zinc-400 hover:bg-white/10"
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCourses.map((course) => (
          <button
            key={course.id}
            onClick={() => startCourse(course)}
            className="glass p-4 rounded-xl border border-white/10 text-left hover:border-blue-500/50 transition-all group"
          >
            {/* Course Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-2xl">
                {course.badge}
              </div>
              {course.elite_required && (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-xs text-purple-400 font-medium">
                  ⭐ Elite
                </span>
              )}
              {(course.completed || sessionCompletedIds.has(course.id) || dbCompletedIds.has(course.id)) && (
                <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-xs text-green-400 font-medium">
                  ✓ Done
                </span>
              )}
            </div>

            {/* Course Info */}
            <h3 className="font-medium text-white mb-1 group-hover:text-blue-400 transition-colors">
              {course.title}
            </h3>
            <p className="text-sm text-zinc-500 mb-3 line-clamp-2">{course.description}</p>

            {/* Meta */}
            <div className="flex items-center gap-3 text-xs">
              <span className="text-zinc-500">⏱ {course.duration_minutes} min</span>
              <span className="text-zinc-500">📖 {course.lessons} lessons</span>
              <span className={`px-2 py-0.5 rounded ${getDifficultyColor(course.difficulty)}`}>
                {course.difficulty}
              </span>
            </div>

            {/* Points */}
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-zinc-500">Earn badge: {course.badge_name}</span>
              <span className="text-sm font-semibold text-blue-400">+{course.points} pts</span>
            </div>

            {/* Progress bar if started */}
            {course.progress !== undefined && course.progress > 0 && course.progress < 100 && (
              <div className="mt-3">
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full" 
                    style={{ width: `${course.progress}%` }} 
                  />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Course Modal */}
      <AnimatePresence>
        {selectedCourse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
            onClick={closeCourse}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-white/10"
            >
              {/* Course Intro */}
              {courseState === "intro" && (
                <div className="p-6">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-3xl">
                      {selectedCourse.badge}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white mb-1">{selectedCourse.title}</h2>
                      <p className="text-sm text-zinc-400">{selectedCourse.description}</p>
                    </div>
                    <button onClick={closeCourse} className="text-zinc-500 hover:text-white ml-auto">✕</button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-3 rounded-xl bg-white/5">
                      <p className="text-lg font-bold text-white">⏱ {selectedCourse.duration_minutes}</p>
                      <p className="text-xs text-zinc-500">Minutes</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-white/5">
                      <p className="text-lg font-bold text-white">📖 {selectedCourse.lessons}</p>
                      <p className="text-xs text-zinc-500">Lessons</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-white/5">
                      <p className="text-lg font-bold text-blue-400">+{selectedCourse.points}</p>
                      <p className="text-xs text-zinc-500">Points</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-6">
                    <p className="text-sm text-white font-medium mb-1">🏅 On completion, you'll earn:</p>
                    <p className="text-zinc-400 text-sm">
                      The "{selectedCourse.badge_name}" badge {selectedCourse.badge} and {selectedCourse.points} points toward your next tier.
                    </p>
                  </div>

                  <button
                    onClick={() => setCourseState("lesson")}
                    className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
                  >
                    Start Course →
                  </button>
                </div>
              )}

              {/* Lesson View */}
              {courseState === "lesson" && (
                <div>
                  {/* Video placeholder */}
                  <div className="aspect-video bg-zinc-800 flex items-center justify-center">
                    <div className="text-center">
                      <span className="text-6xl mb-4 block">🎬</span>
                      <p className="text-zinc-400">Video Lesson {currentLesson + 1}</p>
                      <p className="text-xs text-zinc-600 mt-1">2:30 / 4:15</p>
                    </div>
                  </div>

                  <div className="p-6">
                    {/* Progress */}
                    <div className="flex items-center gap-2 mb-4">
                      {Array.from({ length: selectedCourse.lessons }).map((_, i) => (
                        <div
                          key={i}
                          className={`flex-1 h-1 rounded-full ${
                            i <= currentLesson ? "bg-blue-500" : "bg-white/10"
                          }`}
                        />
                      ))}
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2">
                      Lesson {currentLesson + 1}: Understanding Suspicious Behavior
                    </h3>
                    <p className="text-sm text-zinc-400 mb-6">
                      In this lesson, we cover the key indicators of suspicious behavior and how to 
                      assess threats without creating unnecessary alarm.
                    </p>

                    <div className="flex gap-3">
                      <button
                        onClick={closeCourse}
                        className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                      >
                        Save & Exit
                      </button>
                      <button
                        onClick={() => {
                          if (currentLesson < selectedCourse.lessons - 1) {
                            setCurrentLesson((prev) => prev + 1);
                          } else if (activeQuiz?.length) {
                            setCourseState("quiz");
                          }
                        }}
                        disabled={currentLesson >= selectedCourse.lessons - 1 && !activeQuiz?.length}
                        className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {currentLesson < selectedCourse.lessons - 1
                          ? "Next Lesson →"
                          : activeQuiz?.length
                            ? "Take Quiz →"
                            : "Quiz unavailable"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Quiz View */}
              {courseState === "quiz" &&
                (activeQuiz && activeQuiz[quizIndex] ? (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-semibold text-white">Knowledge Check</h2>
                      <span className="text-sm text-zinc-500">
                        Question {quizIndex + 1} of {activeQuiz.length}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-500 mb-4">
                      Pass mark: {TRAINING_PASS_CORRECT}/{TRAINING_QUIZ_LENGTH} ({Math.round((TRAINING_PASS_CORRECT / TRAINING_QUIZ_LENGTH) * 100)}%). Free retries until you pass.
                    </p>

                    <div className="mb-6">
                      <p className="text-white mb-4">{activeQuiz[quizIndex].question}</p>

                      <div className="space-y-3">
                        {activeQuiz[quizIndex].options.map((option, i) => {
                          const isSelected = selectedAnswer === i;
                          const isCorrect = i === activeQuiz[quizIndex].correct_index;
                          const showResult = selectedAnswer !== null;

                          return (
                            <button
                              key={i}
                              onClick={() => handleAnswerSelect(i)}
                              disabled={selectedAnswer !== null}
                              className={`w-full p-4 rounded-xl text-left transition-all border ${
                                showResult
                                  ? isCorrect
                                    ? "bg-green-500/20 border-green-500/50 text-green-300"
                                    : isSelected
                                      ? "bg-red-500/20 border-red-500/50 text-red-300"
                                      : "bg-white/5 border-white/10 text-zinc-500"
                                  : "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-blue-500/50"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                    showResult && isCorrect
                                      ? "bg-green-500 text-white"
                                      : showResult && isSelected
                                        ? "bg-red-500 text-white"
                                        : "bg-white/10 text-zinc-400"
                                  }`}
                                >
                                  {showResult && isCorrect
                                    ? "✓"
                                    : showResult && isSelected
                                      ? "✗"
                                      : String.fromCharCode(65 + i)}
                                </span>
                                {option}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {showExplanation && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-6"
                      >
                        <p className="text-sm text-blue-300">
                          <strong>Explanation:</strong> {activeQuiz[quizIndex].explanation}
                        </p>
                      </motion.div>
                    )}

                    {showExplanation && (
                      <button
                        onClick={nextQuestion}
                        className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors"
                      >
                        {quizIndex < activeQuiz.length - 1 ? "Next Question →" : "See results →"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-zinc-400 mb-4">No quiz is available for this module yet.</p>
                    <button
                      onClick={closeCourse}
                      className="w-full py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                ))}

              {/* Completion View */}
              {courseState === "complete" && (() => {
                const totalQ = activeQuiz?.length ?? TRAINING_QUIZ_LENGTH;
                const passed = correctAnswers >= TRAINING_PASS_CORRECT;
                return (
                  <div className="p-6 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.2 }}
                      className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center"
                    >
                      <span className="text-5xl">{selectedCourse.badge}</span>
                    </motion.div>

                    <h2 className="text-2xl font-bold text-white mb-2">
                      {passed ? "Course complete!" : "Not quite — try again"}
                    </h2>
                    <p className="text-zinc-400 mb-2">
                      You scored {correctAnswers}/{totalQ} (
                      {totalQ ? Math.round((correctAnswers / totalQ) * 100) : 0}%)
                    </p>
                    {!passed && (
                      <p className="text-sm text-amber-400/90 mb-6">
                        You need {TRAINING_PASS_CORRECT}/{TRAINING_QUIZ_LENGTH} to pass. Retry the quiz for free as many
                        times as you need.
                      </p>
                    )}
                    {passed && <p className="text-zinc-500 text-sm mb-6">Great work — you met the pass mark.</p>}

                    {passed ? (
                      <>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="p-4 rounded-xl bg-white/5">
                            <p className="text-2xl mb-1">{selectedCourse.badge}</p>
                            <p className="text-sm text-white font-medium">&quot;{selectedCourse.badge_name}&quot;</p>
                            <p className="text-xs text-zinc-500">Badge earned</p>
                          </div>
                          <div className="p-4 rounded-xl bg-white/5">
                            <p className="text-2xl font-bold text-blue-400">+{selectedCourse.points}</p>
                            <p className="text-sm text-white font-medium">Points (this session)</p>
                            <p className="text-xs text-zinc-500">Toward next tier</p>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 mb-6">
                          <p className="text-green-400 text-sm">
                            ✓ Saved to your Shield Passport and linked to Shield Score
                          </p>
                        </div>
                      </>
                    ) : null}

                    <div className="flex flex-col gap-3">
                      {!passed && (
                        <button
                          onClick={retryQuiz}
                          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
                        >
                          Retry quiz (free)
                        </button>
                      )}
                      <button
                        onClick={closeCourse}
                        className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                          passed
                            ? "bg-blue-600 text-white hover:bg-blue-500"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        {passed ? "Continue learning" : "Back to courses"}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
