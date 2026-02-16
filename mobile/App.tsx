import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';

const API_BASE = 'http://localhost:8090/api';
let authToken = '';

async function request(path: string, options: any = {}) {
  const headers: any = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const Tab = createBottomTabNavigator();

// Colors
const C = {
  bg: '#0d0d1a', card: '#1a1a2e', gold: '#e0d68a', text: '#e8e8e8',
  dim: '#8888aa', green: '#4ecdc4', orange: '#ff6b35', border: '#2a2a4a',
};

function HomeScreen() {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = async () => {
    try {
      const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      authToken = res.token;
      setLoggedIn(true);
      const l = await request('/leagues');
      setLeagues(l);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (!loggedIn) {
    return (
      <View style={[s.container, s.center]}>
        <Text style={s.title}>🎬 Fantasy Box Office</Text>
        <TextInput style={s.input} placeholder="Email" placeholderTextColor={C.dim} value={email} onChangeText={setEmail} />
        <TextInput style={s.input} placeholder="Password" placeholderTextColor={C.dim} value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity style={s.btn} onPress={login}><Text style={s.btnText}>Sign In</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>My Leagues</Text>
      {leagues.length === 0 ? (
        <Text style={s.dim}>No leagues yet</Text>
      ) : (
        <FlatList data={leagues} keyExtractor={i => String(i.id)} renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.cardTitle}>{item.name}</Text>
            <Text style={s.dim}>{item.season_year} · {item.status}</Text>
          </View>
        )} />
      )}
    </View>
  );
}

function MyTeamScreen() {
  return (
    <View style={s.container}>
      <Text style={s.title}>My Team</Text>
      <Text style={s.dim}>Select a league to view your team roster</Text>
    </View>
  );
}

function DraftScreen() {
  const [movies, setMovies] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/movies?status=upcoming`).then(r => r.json()).then(setMovies).catch(() => {});
  }, []);

  return (
    <View style={s.container}>
      <Text style={s.title}>Draft</Text>
      <FlatList data={movies} keyExtractor={i => String(i.id)} renderItem={({ item }) => (
        <View style={s.card}>
          <Text style={s.cardTitle}>{item.title}</Text>
          <Text style={s.dim}>{item.release_date}</Text>
        </View>
      )} />
    </View>
  );
}

function LeagueScreen() {
  return (
    <View style={s.container}>
      <Text style={s.title}>League</Text>
      <Text style={s.dim}>Standings, trades, and more</Text>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border },
        tabBarActiveTintColor: C.gold,
        tabBarInactiveTintColor: C.dim,
        headerStyle: { backgroundColor: C.card },
        headerTintColor: C.gold,
      }}>
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: '🏠 Home' }} />
        <Tab.Screen name="My Team" component={MyTeamScreen} options={{ tabBarLabel: '🎬 Team' }} />
        <Tab.Screen name="Draft" component={DraftScreen} options={{ tabBarLabel: '📋 Draft' }} />
        <Tab.Screen name="League" component={LeagueScreen} options={{ tabBarLabel: '🏆 League' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 16 },
  center: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: C.gold, marginBottom: 16 },
  dim: { color: C.dim, fontSize: 14 },
  card: { backgroundColor: C.card, padding: 16, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  input: { width: '100%', maxWidth: 300, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, color: C.text, marginBottom: 10, fontSize: 16 },
  btn: { backgroundColor: C.gold, paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10 },
  btnText: { color: '#111', fontWeight: '700', fontSize: 16 },
});
