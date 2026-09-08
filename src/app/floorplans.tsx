import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FLOORS, type Floor } from '@/config/floorplans';
import { Spacing } from '@/constants/theme';

function FloorPage({ floor, width }: { floor: Floor; width: number }) {
  return (
    <View style={[styles.page, { width }]}>
      {floor.image ? (
        <Image source={floor.image} style={styles.plan} contentFit="contain" />
      ) : (
        <View style={styles.emptyPlan}>
          <ThemedText type="subtitle">{floor.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            No floorplan image yet — set `image` for this floor in src/config/floorplans.ts
          </ThemedText>
        </View>
      )}
    </View>
  );
}

export default function FloorplansScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  return (
    <ThemedView style={styles.container} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          // Page width is measured from layout rather than the window, so the sidebar
          // and safe-area insets can't throw the paging off.
          style={styles.pager}>
          {FLOORS.map((floor) => (
            <FloorPage key={floor.id} floor={floor} width={width} />
          ))}
        </ScrollView>
      )}

      {/* Floor indicator — also tappable, since swiping isn't discoverable on a wall panel. */}
      <View style={styles.indicator} pointerEvents="box-none">
        {FLOORS.map((floor, i) => {
          const active = i === index;
          return (
            <Pressable
              key={floor.id}
              onPress={() => goTo(i)}
              accessibilityRole="button"
              accessibilityLabel={floor.name}
              accessibilityState={{ selected: active }}
              hitSlop={10}>
              <ThemedView
                type={active ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.pill}>
                <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                  {floor.name}
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plan: {
    width: '100%',
    height: '100%',
  },
  emptyPlan: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  indicator: {
    position: 'absolute',
    bottom: Spacing.three,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  pill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
});
