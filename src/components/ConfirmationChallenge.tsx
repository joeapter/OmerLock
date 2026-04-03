import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { colors, radius, spacing } from '../constants/theme';
import { buildMultipleChoice, pickChallenge } from '../utils/challenge';

interface Props {
  day: number;
  onSuccess: (method: 'swipe_hold' | 'enter_number' | 'multiple_choice') => void;
}

export const ConfirmationChallenge = ({ day, onSuccess }: Props) => {
  const [mode, setMode] = useState(() => pickChallenge());
  const [typedDay, setTypedDay] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);

  const choices = useMemo(() => buildMultipleChoice(day), [day, mode]);

  useEffect(() => {
    setTypedDay('');
    setSelectedChoice(null);
    setHoldProgress(0);
  }, [mode]);

  useEffect(
    () => () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    },
    []
  );

  const stopHoldTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startRef.current = 0;
    setHoldProgress(0);
  };

  const startHoldTimer = () => {
    stopHoldTimer();
    startRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const progress = Math.min(1, elapsed / 2000);
      setHoldProgress(progress);

      if (progress >= 1) {
        stopHoldTimer();
        onSuccess('swipe_hold');
      }
    }, 50);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Confirmation</Text>
      <Text style={styles.subtitle}>
        Complete one quick step to mark tonight as counted.
      </Text>

      {mode === 'swipe_hold' ? (
        <View style={styles.challengeCard}>
          <Text style={styles.challengeTitle}>Hold to confirm</Text>
          <Text style={styles.challengeText}>Press and hold for 2 full seconds.</Text>
          <Pressable
            onPressIn={startHoldTimer}
            onPressOut={stopHoldTimer}
            style={styles.holdButton}
          >
            <View style={[styles.progressBar, { width: `${holdProgress * 100}%` }]} />
            <Text style={styles.holdLabel}>Hold to confirm day {day}</Text>
          </Pressable>
        </View>
      ) : null}

      {mode === 'enter_number' ? (
        <View style={styles.challengeCard}>
          <Text style={styles.challengeTitle}>Enter tonight's day</Text>
          <Text style={styles.challengeText}>Type: {day}</Text>
          <TextInput
            value={typedDay}
            onChangeText={setTypedDay}
            keyboardType="number-pad"
            placeholder="Enter day number"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
          <TouchableOpacity
            onPress={() => {
              if (Number(typedDay.trim()) === day) {
                onSuccess('enter_number');
              }
            }}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>Check</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {mode === 'multiple_choice' ? (
        <View style={styles.challengeCard}>
          <Text style={styles.challengeTitle}>Pick tonight's day</Text>
          <Text style={styles.challengeText}>Select tonight's Omer day:</Text>
          <View style={styles.choiceRow}>
            {choices.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setSelectedChoice(option)}
                style={[
                  styles.choicePill,
                  selectedChoice === option && styles.choicePillSelected
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    selectedChoice === option && styles.choiceTextSelected
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => {
              if (selectedChoice === day) {
                onSuccess('multiple_choice');
              }
            }}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={() => setMode(pickChallenge())}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>Try another method</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    gap: spacing.sm
  },
  title: {
    fontSize: 20,
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  subtitle: {
    color: colors.textSecondary,
    lineHeight: 20,
    fontFamily: 'SpaceGrotesk_400Regular'
  },
  challengeCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm
  },
  challengeTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  challengeText: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_400Regular'
  },
  holdButton: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    height: 50,
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated
  },
  progressBar: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.accentMuted
  },
  holdLabel: {
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: 'SpaceGrotesk_400Regular'
  },
  actionButton: {
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm
  },
  actionButtonText: {
    textAlign: 'center',
    color: '#041311',
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  choicePill: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceElevated
  },
  choicePillSelected: {
    borderColor: colors.accent,
    backgroundColor: '#123A31'
  },
  choiceText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  choiceTextSelected: {
    color: colors.textPrimary
  },
  secondaryButton: {
    alignSelf: 'flex-start'
  },
  secondaryButtonText: {
    color: colors.warning,
    fontFamily: 'SpaceGrotesk_700Bold'
  }
});
