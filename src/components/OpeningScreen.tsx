import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

export const OpeningScreen = () => (
  <View style={styles.container}>
    <View style={styles.centerGroup}>
      <Text style={styles.title}>OmerLock</Text>
      <Text style={styles.subtitle}>Nightly Omer reminders</Text>
      <Image
        source={require('../../assets/icon.png')}
        style={styles.icon}
        resizeMode="contain"
      />
    </View>

    <View style={styles.footer}>
      <Text style={styles.fromText}>From</Text>
      <Text style={styles.brandText}>SystemAddict</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  centerGroup: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: -40
  },
  title: {
    color: '#0E1114',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  subtitle: {
    color: '#646F76',
    fontSize: 17,
    letterSpacing: 0.3,
    marginBottom: 6
  },
  icon: {
    width: 138,
    height: 138
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center'
  },
  fromText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 1
  },
  brandText: {
    color: '#34C759',
    fontSize: 33,
    lineHeight: 36,
    fontWeight: '700'
  }
});
