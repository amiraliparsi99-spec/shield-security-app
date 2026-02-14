import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { colors } from "../../theme";
import { PremiumTabBar } from "../../components/navigation/PremiumTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="explore"
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBarHidden, // Hide default tab bar
      }}
      tabBar={(props) => <PremiumTabBar {...props} />}
    >
      <Tabs.Screen 
        name="explore" 
        options={{ 
          title: "Explore", 
        }} 
      />
      <Tabs.Screen 
        name="messages" 
        options={{ 
          title: "Messages", 
        }} 
      />
      <Tabs.Screen 
        name="payments" 
        options={{ 
          title: "Payments", 
        }} 
      />
      <Tabs.Screen 
        name="account" 
        options={{ 
          title: "Account", 
        }} 
      />
      <Tabs.Screen 
        name="settings" 
        options={{ 
          title: "Settings", 
        }} 
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarHidden: {
    position: "absolute",
    backgroundColor: "transparent",
    borderTopWidth: 0,
    elevation: 0,
    height: 0,
  },
});
