import { AntDesign } from '@expo/vector-icons';
import {
    TabList,
    TabListProps,
    Tabs,
    TabSlot,
    TabTrigger,
    TabTriggerSlotProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedStyle,
    useDerivedValue,
    withSpring,
} from 'react-native-reanimated';

const iconSize = 20;

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton label="Home" icon="home" />
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton label="Explore" icon="appstore" />
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  label,
  icon,
  isFocused,
  ...props
}: TabTriggerSlotProps & {
  label: string;
  icon: keyof typeof AntDesign.glyphMap;
}) {
  const { width } = useWindowDimensions();
  const maxWidth = Math.min(170, Math.max(130, width * 0.35));
  const minWidth = Math.max(64, Math.min(110, (width - 56 - maxWidth) / 1));
  const progress = useDerivedValue(() => withSpring(isFocused ? 1 : 0, { dampingRatio: 1, duration: 400 }), [isFocused]);
  const tabStyle = useAnimatedStyle(() => ({ width: interpolate(progress.value, [0, 1], [minWidth, maxWidth]) }), [minWidth, maxWidth]);
  const labelStyle = useAnimatedStyle(() => ({ opacity: progress.value ** 3, marginLeft: interpolate(progress.value, [0, 1], [0, 15]) }));
  const iconStyle = useAnimatedStyle(() => ({ left: interpolate(progress.value, [0, 1], [(minWidth - iconSize) / 2, iconSize]) }), [minWidth]);

  return (
    <Pressable {...props} accessibilityRole="tab" style={styles.pressable}>
      <Animated.View style={[styles.tab, tabStyle]}>
        <View style={styles.tabInner}>
          <Animated.View style={[styles.icon, iconStyle]}>
            <AntDesign name={icon} size={iconSize} color="#18181B" />
          </Animated.View>
          <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>{label}</Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  return <View {...props} style={styles.tabList} />;
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
  tabList: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 18,
    backgroundColor: 'transparent',
  },
  pressable: { marginHorizontal: 5 },
  tab: {
    height: 60,
    borderRadius: 15,
    backgroundColor: '#F1F1F1',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabInner: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: { position: 'absolute', width: iconSize, height: iconSize, zIndex: 2 },
  label: { color: '#18181B', fontSize: 16, fontWeight: '500', zIndex: 2 },
});
