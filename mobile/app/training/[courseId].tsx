import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { colors, typography, spacing, radius, gradients } from "../../theme";
import { getCourseById } from "../../data/training-courses";
import {
  getQuizForCourse,
  TRAINING_PASS_CORRECT,
  TRAINING_QUIZ_LENGTH,
  type QuizQuestion,
} from "../../data/training-quizzes";
import { supabase } from "../../lib/supabase";
import { getMyPersonnelId, markTrainingComplete } from "../../lib/trainingProgress";
import { BackButton } from "../../components/ui/BackButton";
import { GuestGate } from "../../components/auth/GuestGate";

type Phase = "intro" | "quiz" | "results";

export default function TrainingCourseScreen() {
  return (
    <GuestGate feature="training">
      <TrainingCourseScreenContent />
    </GuestGate>
  );
}

function TrainingCourseScreenContent() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const course = useMemo(() => (courseId ? getCourseById(courseId) : undefined), [courseId]);
  const quiz = useMemo(
    () => (courseId ? getQuizForCourse(courseId) : null),
    [courseId]
  );

  const [phase, setPhase] = useState<Phase>("intro");
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [syncingPass, setSyncingPass] = useState(false);
  const [savedCompletion, setSavedCompletion] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const autoSaveAttemptedRef = useRef(false);

  const currentQuestion: QuizQuestion | undefined = quiz?.[quizIndex];

  const resetQuiz = useCallback(() => {
    setQuizIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setCorrectCount(0);
    setPhase("quiz");
  }, []);

  const handleAnswer = useCallback(
    (index: number) => {
      if (selectedAnswer !== null || !quiz || !currentQuestion) return;
      setSelectedAnswer(index);
      setShowExplanation(true);
      if (index === currentQuestion.correct_index) {
        setCorrectCount((c) => c + 1);
      }
    },
    [selectedAnswer, quiz, currentQuestion]
  );

  const nextQuestion = useCallback(() => {
    if (!quiz) return;
    if (quizIndex < quiz.length - 1) {
      setQuizIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setPhase("results");
    }
  }, [quiz, quizIndex]);

  if (!courseId || !course) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={["#0a0a0f", "#111118"]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <Text style={styles.errorTitle}>Course not found</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  if (!quiz || quiz.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={["#0a0a0f", "#111118"]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea}>
          <Text style={styles.errorTitle}>Quiz unavailable</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const passed = correctCount >= TRAINING_PASS_CORRECT;
  const pct = Math.round((correctCount / TRAINING_QUIZ_LENGTH) * 100);

  const persistPass = useCallback(async () => {
    if (!passed || savedCompletion || syncingPass || !course || !supabase) return;
    setSyncingPass(true);
    setSaveError(null);
    try {
      const pid = await getMyPersonnelId(supabase);
      if (!pid) return;
      await markTrainingComplete(supabase, pid, course, pct);
      setSavedCompletion(true);
    } catch (e) {
      console.warn("Failed to sync training completion:", e);
      setSaveError("Save failed. Tap to retry.");
    } finally {
      setSyncingPass(false);
    }
  }, [passed, savedCompletion, syncingPass, course, pct]);

  useEffect(() => {
    if (phase === "results" && passed && !autoSaveAttemptedRef.current) {
      autoSaveAttemptedRef.current = true;
      persistPass();
    }
  }, [phase, passed, persistPass]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={["#0a0a0f", "#111118", "#0a0a0f"]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {course.title}
          </Text>
          <View style={styles.headerRight} />
        </View>

        {phase === "intro" && (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{course.badge}</Text>
            </View>
            <Text style={styles.introKicker}>Compliance module</Text>
            <Text style={styles.introTitle}>{course.title}</Text>
            <Text style={styles.introBody}>{course.description}</Text>
            <View style={styles.introMetaRow}>
              <Text style={styles.introMeta}>⏱ {course.duration} min</Text>
              <Text style={styles.introMeta}>📖 {course.lessons} sections</Text>
              <Text style={styles.introMeta}>✓ {TRAINING_QUIZ_LENGTH} questions</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Knowledge check</Text>
              <Text style={styles.infoText}>
                Answer {TRAINING_QUIZ_LENGTH} multiple-choice questions. You need at least{" "}
                {TRAINING_PASS_CORRECT} correct ({Math.round((TRAINING_PASS_CORRECT / TRAINING_QUIZ_LENGTH) * 100)}%)
                to pass. Retries are free until you pass.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.primaryBtnWrap}
              onPress={() => {
                resetQuiz();
                setPhase("quiz");
              }}
              activeOpacity={0.9}
            >
              <LinearGradient colors={gradients.accent} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Begin quiz</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        )}

        {phase === "quiz" && currentQuestion && (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.quizProgress}>
              Question {quizIndex + 1} of {quiz.length}
            </Text>
            <Text style={styles.questionText}>{currentQuestion.question}</Text>

            {currentQuestion.options.map((option, i) => {
              const isSelected = selectedAnswer === i;
              const isCorrect = i === currentQuestion.correct_index;
              const show = selectedAnswer !== null;
              let rowStyle = styles.optionRow;
              if (show) {
                if (isCorrect) rowStyle = { ...styles.optionRow, ...styles.optionCorrect };
                else if (isSelected) rowStyle = { ...styles.optionRow, ...styles.optionWrong };
                else rowStyle = { ...styles.optionRow, ...styles.optionMuted };
              }
              return (
                <TouchableOpacity
                  key={i}
                  style={rowStyle}
                  onPress={() => handleAnswer(i)}
                  disabled={selectedAnswer !== null}
                  activeOpacity={0.85}
                >
                  <View style={styles.optionLetter}>
                    <Text style={styles.optionLetterText}>
                      {show && isCorrect ? "✓" : show && isSelected ? "✗" : String.fromCharCode(65 + i)}
                    </Text>
                  </View>
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              );
            })}

            {showExplanation && (
              <View style={styles.explanationBox}>
                <Text style={styles.explanationLabel}>Explanation</Text>
                <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
              </View>
            )}

            {showExplanation && (
              <TouchableOpacity style={styles.nextBtn} onPress={nextQuestion} activeOpacity={0.9}>
                <Text style={styles.nextBtnText}>
                  {quizIndex < quiz.length - 1 ? "Next question →" : "See results →"}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {phase === "results" && (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.resultsIconWrap}>
              <Text style={styles.resultsEmoji}>{passed ? "🎓" : "📋"}</Text>
            </View>
            <Text style={styles.resultsTitle}>{passed ? "You passed" : "Not quite"}</Text>
            <Text style={styles.resultsScore}>
              Score: {correctCount}/{TRAINING_QUIZ_LENGTH} ({pct}%)
            </Text>
            {!passed && (
              <Text style={styles.resultsHint}>
                You need {TRAINING_PASS_CORRECT}/{TRAINING_QUIZ_LENGTH} to pass. Retry the quiz for free as many times as
                you need.
              </Text>
            )}
            {passed && (
              <Text style={styles.resultsPassHint}>
                You earned the &quot;{course.badgeName}&quot; badge and +{course.points} points toward your Shield Passport.
              </Text>
            )}
            {passed && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={persistPass} disabled={savedCompletion || syncingPass}>
                <Text style={styles.secondaryBtnText}>
                  {savedCompletion ? "Saved to Shield Passport" : syncingPass ? "Saving..." : "Save to Shield Passport"}
                </Text>
              </TouchableOpacity>
            )}
            {saveError ? <Text style={styles.resultsHint}>{saveError}</Text> : null}

            <View style={styles.resultsActions}>
              {!passed ? (
                <TouchableOpacity style={styles.primaryBtnWrap} onPress={resetQuiz} activeOpacity={0.9}>
                  <LinearGradient colors={gradients.accent} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Retry quiz</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.replace("/training")}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryBtnText}>Back to Training Academy</Text>
              </TouchableOpacity>
              {!passed ? (
                <TouchableOpacity onPress={() => router.replace("/training")} hitSlop={12}>
                  <Text style={styles.linkText}>Leave for now</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0f" },
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: { flex: 1, ...typography.body, fontWeight: "700", color: colors.text, textAlign: "center" },
  headerRight: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  errorTitle: { ...typography.title, color: colors.text, marginBottom: spacing.lg },
  heroBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroBadgeText: { fontSize: 36 },
  introKicker: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  introTitle: { ...typography.title, color: colors.text, marginBottom: spacing.sm },
  introBody: { ...typography.body, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.md },
  introMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.lg },
  introMeta: { ...typography.caption, color: colors.textSecondary },
  infoBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
    marginBottom: spacing.lg,
  },
  infoTitle: { ...typography.body, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  infoText: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  primaryBtnWrap: { borderRadius: radius.lg, overflow: "hidden", marginBottom: spacing.md },
  primaryBtn: { paddingVertical: 16, alignItems: "center" },
  primaryBtnText: { ...typography.body, fontWeight: "800", color: "#03120f" },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorderAccent,
    marginBottom: spacing.sm,
  },
  secondaryBtnText: { ...typography.body, color: colors.accentLight, fontWeight: "600" },
  linkText: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
  quizProgress: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  questionText: { ...typography.title, fontSize: 18, color: colors.text, marginBottom: spacing.lg, lineHeight: 26 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  optionCorrect: { borderColor: colors.success, backgroundColor: colors.successSoft },
  optionWrong: { borderColor: colors.error, backgroundColor: colors.errorSoft },
  optionMuted: { opacity: 0.5 },
  optionLetter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.glassStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLetterText: { ...typography.caption, fontWeight: "700", color: colors.text },
  optionText: { flex: 1, ...typography.bodySmall, color: colors.text },
  explanationBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(0,212,170,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,212,170,0.35)",
    marginBottom: spacing.lg,
  },
  explanationLabel: { ...typography.caption, fontWeight: "700", color: colors.accentLight, marginBottom: spacing.xs },
  explanationText: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  nextBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  nextBtnText: { ...typography.body, fontWeight: "800", color: "#03120f" },
  resultsIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceElevated,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultsEmoji: { fontSize: 44 },
  resultsTitle: { ...typography.title, fontSize: 24, color: colors.text, textAlign: "center", marginBottom: spacing.sm },
  resultsScore: { ...typography.body, color: colors.accentLight, textAlign: "center", fontWeight: "800", marginBottom: spacing.md },
  resultsHint: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center", lineHeight: 20, marginBottom: spacing.lg },
  resultsPassHint: { ...typography.bodySmall, color: colors.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: spacing.lg },
  resultsActions: { marginTop: spacing.md },
});
