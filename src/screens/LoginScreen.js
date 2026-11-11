import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';

const PIN_SUPERADMIN = '6789';

export default function LoginScreen({ navigation }) {
  const [ci, setCi] = useState('');
  const [pinAdmin, setPinAdmin] = useState('');
  const [modoSuperadmin, setModoSuperadmin] = useState(false);
  const [cargando, setCargando] = useState(false);

  const iniciarSesion = async () => {
    // 1. Acceso de Superadmin por Clave Maestra
    if (modoSuperadmin) {
      if (pinAdmin === PIN_SUPERADMIN) {
        navigation.replace('SeleccionarInstructor', { modoAdminForzado: true });
      } else {
        Alert.alert('Acceso Denegado', 'PIN de Superadmin incorrecto.');
        setPinAdmin('');
      }
      return;
    }

    // 2. Acceso regular de Instructores por C.I.
    if (!ci.trim()) {
      Alert.alert('Atención', 'Ingrese su Cédula de Identidad (CI) militar.');
      return;
    }

    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('instructores')
        .select('*')
        .eq('ci', ci.trim())
        .eq('activo', true)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        Alert.alert(
          'Personal no encontrado',
          'El CI ingresado no figura en la nómina activa de instructores. Contacte al Comando o ingrese con clave Superadmin.'
        );
        return;
      }

      // Instructor autenticado con éxito -> Pasa a Selección de Instructor / Función
      navigation.replace('SeleccionarInstructor', { instructorLogueado: data });
    } catch (err) {
      Alert.alert('Error de Conexión', err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#141810" />

      {/* Franja Camuflada MultiCam Superior */}
      <View style={styles.camoStripeContainer}>
        <View style={[styles.camoBlock, { backgroundColor: '#283618', flex: 1.2 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#414833', flex: 1 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#60492c', flex: 0.8 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#dda15e', flex: 0.6 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#bc6c25', flex: 1.1 }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Insignia y Cabecera Militar con Logotipo */}
          <View style={styles.header}>
            <View style={styles.logoContenedor}>
              <Image
                source={require('../../assets/logoAppCfor.png')}
                style={styles.logoImagen}
                resizeMode="cover"
              />
            </View>

            <Text style={styles.tituloPais}>ESCUELA MILITAR DE INGENIERIA</Text>
            <Text style={styles.tituloUnidad}>COMPAÑÍA CFOR</Text>
            <View style={styles.lineaDecorativa} />
            <Text style={styles.subtituloLema}>SISTEMA DE CONTROL Y ASISTENCIA</Text>
          </View>

          {/* Tarjeta de Inicio Táctico */}
          <View style={styles.cardLogin}>
            <View style={styles.cardHeader}>
              <Ionicons
                name={modoSuperadmin ? 'key' : 'finger-print'}
                size={20}
                color="#dda15e"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.cardTitulo}>
                {modoSuperadmin ? 'ACCESO COMANDO SUPERADMIN' : 'IDENTIFICACIÓN DEL INSTRUCTOR'}
              </Text>
            </View>

            {modoSuperadmin ? (
              <View style={styles.inputGrupo}>
                <Text style={styles.lblInput}>PIN MAESTRO DE SEGURIDAD</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed" size={18} color="#dda15e" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { letterSpacing: 8, fontSize: 18, textAlign: 'center' }]}
                    placeholder="••••"
                    placeholderTextColor="#6c757d"
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={6}
                    value={pinAdmin}
                    onChangeText={setPinAdmin}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.inputGrupo}>
                <Text style={styles.lblInput}>CÉDULA DE IDENTIDAD (C.I.)</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person" size={18} color="#dda15e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Ingrese su número de CI"
                    placeholderTextColor="#6c757d"
                    keyboardType="numeric"
                    value={ci}
                    onChangeText={setCi}
                  />
                </View>
              </View>
            )}

            {/* Botón de Ingreso Táctico */}
            <TouchableOpacity
              style={styles.btnIngreso}
              activeOpacity={0.8}
              onPress={iniciarSesion}
              disabled={cargando}
            >
              {cargando ? (
                <ActivityIndicator color="#fefae0" />
              ) : (
                <View style={styles.btnIngresoRow}>
                  <Ionicons name="log-in-outline" size={20} color="#fefae0" style={{ marginRight: 8 }} />
                  <Text style={styles.btnIngresoTxt}>
                    {modoSuperadmin ? 'AUTENTICAR COMANDO' : 'INGRESAR A FORMACIÓN'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Alternador de Modo Superadmin */}
            <TouchableOpacity
              style={styles.btnCambiarModo}
              onPress={() => {
                setModoSuperadmin(!modoSuperadmin);
                setCi('');
                setPinAdmin('');
              }}
            >
              <Ionicons
                name={modoSuperadmin ? 'people-outline' : 'shield-half-outline'}
                size={16}
                color="#dda15e"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.btnCambiarModoTxt}>
                {modoSuperadmin
                  ? '← Volver a ingreso con C.I. de Instructor'
                  : 'Ingreso Superadmin (Clave de Comando)'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Pie Militar */}
          <View style={styles.footer}>
            <Text style={styles.footerSeguridad}>PRESTIGIO, DISCIPLINA Y MEJORES OPORTUNIDADES</Text>
            <Text style={styles.footerVersion}>CFOR • GESTIÓN {new Date().getFullYear()}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Franja Camuflada MultiCam Inferior */}
      <View style={styles.camoStripeContainer}>
        <View style={[styles.camoBlock, { backgroundColor: '#bc6c25', flex: 0.9 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#dda15e', flex: 0.7 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#414833', flex: 1.3 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#283618', flex: 1 }]} />
        <View style={[styles.camoBlock, { backgroundColor: '#60492c', flex: 0.8 }]} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141810', // Carbón Táctico
  },
  camoStripeContainer: {
    height: 6,
    flexDirection: 'row',
    width: '100%',
  },
  camoBlock: {
    height: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 26,
  },
  logoContenedor: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#283618',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#dda15e', // Coyote Light
    elevation: 8,
    shadowColor: '#dda15e',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    marginBottom: 14,
    overflow: 'hidden',
  },
  logoImagen: {
    width: '100%',
    height: '100%',
  },
  tituloPais: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dda15e',
    letterSpacing: 2,
  },
  tituloUnidad: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fefae0',
    letterSpacing: 2,
    marginTop: 4,
  },
  lineaDecorativa: {
    width: 60,
    height: 2,
    backgroundColor: '#dda15e',
    marginVertical: 6,
  },
  subtituloLema: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a3b18a',
    letterSpacing: 1,
    textAlign: 'center',
  },
  cardLogin: {
    backgroundColor: '#1c2217', // Fondo Táctico Neutro
    borderRadius: 14,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#414833',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#344e41',
    paddingBottom: 10,
  },
  cardTitulo: {
    fontSize: 12,
    fontWeight: '900',
    color: '#dda15e',
    letterSpacing: 1,
  },
  inputGrupo: {
    marginBottom: 18,
  },
  lblInput: {
    fontSize: 11,
    fontWeight: '800',
    color: '#a3b18a',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141810',
    borderWidth: 1.5,
    borderColor: '#414833',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#fefae0',
    fontWeight: '700',
  },
  btnIngreso: {
    backgroundColor: '#606c38', // MultiCam Woodland Green
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dda15e',
    elevation: 3,
  },
  btnIngresoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnIngresoTxt: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fefae0',
    letterSpacing: 1,
  },
  btnCambiarModo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 6,
  },
  btnCambiarModoTxt: {
    fontSize: 11,
    color: '#dda15e',
    fontWeight: '700',
  },
  footer: {
    marginTop: 26,
    alignItems: 'center',
  },
  footerSeguridad: {
    fontSize: 10,
    fontWeight: '800',
    color: '#588157',
    letterSpacing: 1,
  },
  footerVersion: {
    fontSize: 10,
    color: '#414833',
    fontWeight: '700',
    marginTop: 2,
  },
});