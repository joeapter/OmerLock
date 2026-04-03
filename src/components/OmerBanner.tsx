import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../constants/theme';

interface Props {
  text: string;
}

export const OmerBanner = ({ text }: Props) => (
  <View style={styles.banner}>
    <Text style={styles.text}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.banner,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#24503C',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  text: {
    color: colors.textPrimary,
    fontFamily: 'SpaceGrotesk_700Bold'
  }
});
