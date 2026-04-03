import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { NUSACH_OPTIONS } from '../constants/nusach';
import { colors, radius, spacing } from '../constants/theme';
import { SettingsState } from '../types';

interface Props {
  settings: SettingsState;
  missedOverride: boolean;
  onUpdateSettings: (patch: Partial<SettingsState>) => Promise<void>;
  onMarkMissedEarlier: () => Promise<void>;
  onClearMissedEarlier: () => Promise<void>;
  onResetCycle: () => Promise<void>;
}

const frequencyOptions = [5, 10, 15];
const snoozeOptions: Array<10 | 20 | 30> = [10, 20, 30];

export const SettingsScreen = ({
  settings,
  missedOverride,
  onUpdateSettings,
  onMarkMissedEarlier,
  onClearMissedEarlier,
  onResetCycle
}: Props) => {
  const [fallbackTimeInput, setFallbackTimeInput] = useState(settings.fallbackTzeit);
  const [busy, setBusy] = useState(false);

  const canSaveFallbackTime = useMemo(
    () => /^\d{2}:\d{2}$/.test(fallbackTimeInput.trim()),
    [fallbackTimeInput]
  );

  const guarded = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>General</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Show bracha</Text>
          <Switch
            value={settings.showBracha}
            onValueChange={(value) =>
              guarded(() => onUpdateSettings({ showBracha: value }))
            }
            thumbColor={colors.textPrimary}
            trackColor={{ false: '#3C4254', true: colors.accentMuted }}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Hardcore mode</Text>
          <Switch
            value={settings.hardcoreMode}
            onValueChange={(value) =>
              guarded(() => onUpdateSettings({ hardcoreMode: value }))
            }
            thumbColor={colors.textPrimary}
            trackColor={{ false: '#3C4254', true: colors.accentMuted }}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Escalation reminders</Text>
          <Switch
            value={settings.escalationEnabled}
            onValueChange={(value) =>
              guarded(() => onUpdateSettings({ escalationEnabled: value }))
            }
            thumbColor={colors.textPrimary}
            trackColor={{ false: '#3C4254', true: colors.accentMuted }}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Nusach style</Text>
        <View style={styles.pillRow}>
          {NUSACH_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.pill,
                settings.nusach === option.key && styles.pillSelected
              ]}
              onPress={() => guarded(() => onUpdateSettings({ nusach: option.key }))}
            >
              <Text
                style={[
                  styles.pillLabel,
                  settings.nusach === option.key && styles.pillLabelSelected
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Reminder cadence</Text>
        <View style={styles.pillRow}>
          {frequencyOptions.map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.pill,
                settings.reminderBaseMinutes === value && styles.pillSelected
              ]}
              onPress={() =>
                guarded(() => onUpdateSettings({ reminderBaseMinutes: value }))
              }
            >
              <Text
                style={[
                  styles.pillLabel,
                  settings.reminderBaseMinutes === value && styles.pillLabelSelected
                ]}
              >
                Every {value}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.secondaryLabel}>Default snooze</Text>
        <View style={styles.pillRow}>
          {snoozeOptions.map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.pill,
                settings.defaultSnoozeMinutes === value && styles.pillSelected
              ]}
              onPress={() =>
                guarded(() => onUpdateSettings({ defaultSnoozeMinutes: value }))
              }
            >
              <Text
                style={[
                  styles.pillLabel,
                  settings.defaultSnoozeMinutes === value && styles.pillLabelSelected
                ]}
              >
                {value}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Fallback tzeit (HH:MM)</Text>
        <TextInput
          value={fallbackTimeInput}
          onChangeText={setFallbackTimeInput}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          placeholder="20:30"
          placeholderTextColor={colors.textSecondary}
        />
        <TouchableOpacity
          disabled={!canSaveFallbackTime || busy}
          style={[
            styles.action,
            (!canSaveFallbackTime || busy) && styles.disabled
          ]}
          onPress={() =>
            guarded(() =>
              onUpdateSettings({ fallbackTzeit: fallbackTimeInput.trim() })
            )
          }
        >
          <Text style={styles.actionText}>Save fallback time</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Halachic Overrides</Text>
        <TouchableOpacity
          style={styles.outlineAction}
          onPress={() => guarded(() => onMarkMissedEarlier())}
        >
          <Text style={styles.outlineActionText}>I missed an earlier day</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.outlineAction}
          onPress={() => guarded(() => onClearMissedEarlier())}
        >
          <Text style={styles.outlineActionText}>
            Clear missed-day override ({missedOverride ? 'On' : 'Off'})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => guarded(() => onResetCycle())}
        >
          <Text style={styles.resetButtonText}>Reset this Omer cycle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingBottom: spacing.xl
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    letterSpacing: 0.4
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  rowLabel: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_400Regular'
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface
  },
  pillSelected: {
    borderColor: colors.accent,
    backgroundColor: '#123A31'
  },
  pillLabel: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  pillLabelSelected: {
    color: colors.textPrimary
  },
  secondaryLabel: {
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginTop: spacing.sm
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk_400Regular',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  action: {
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm
  },
  actionText: {
    textAlign: 'center',
    color: '#041311',
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  disabled: {
    opacity: 0.5
  },
  outlineAction: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm
  },
  outlineActionText: {
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  resetButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing.sm
  },
  resetButtonText: {
    textAlign: 'center',
    color: colors.danger,
    fontFamily: 'SpaceGrotesk_700Bold'
  }
});
