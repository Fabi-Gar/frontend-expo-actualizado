// components/CierreEditor.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Chip,
  ActivityIndicator,
  HelperText,
  RadioButton,
  Divider,
} from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import {
  getCierre,
  patchCierreCatalogos,
  finalizarCierre,
  reabrirCierre,
  type EstadoCierre,
} from '@/services/cierre';

import {
  listCatalogoItems,
  type CatalogoItem,
} from '@/services/catalogos';

import { getUser } from '@/session';

const tecnicaSlugFromNombre = (nombre?: string) => {
  const s = (nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!s) return undefined;

  if (s.includes('control') && s.includes('natural')) return 'control_natural';
  if (s.includes('indirect')) return 'indirecto';
  if (s.includes('direct')) return 'directo';

  return undefined;
};


type TecnicaSlug = 'directo' | 'indirecto' | 'control_natural';
const isTecnicaSlug = (s: any): s is TecnicaSlug =>
  s === 'directo' || s === 'indirecto' || s === 'control_natural';

const tecnicaIdFromSlug = (
  slug: TecnicaSlug,
  tecnicasCat: CatalogoItem[]
) => {
  const item = tecnicasCat.find((t) => tecnicaSlugFromNombre(t.nombre) === slug);
  return item?.id;
};

/* =======================
 * Diálogo de selección
 * ======================= */
function SelectDialog({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: CatalogoItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dialogOverlay}>
        <View style={styles.dialogCard}>
          <Text style={[styles.dialogTitle, styles.txt]}>{title}</Text>
          <Divider />
          <ScrollView style={{ maxHeight: 360, marginTop: 6 }}>
            <RadioButton.Group onValueChange={(v) => onSelect(v)} value={selectedId ?? ''}>
              {options.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => onSelect(opt.id)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, paddingVertical: 8 }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <RadioButton value={opt.id} color="#2E7D32" />
                    <Text style={styles.txt}>{opt.nombre}</Text>
                  </View>
                </Pressable>
              ))}
            </RadioButton.Group>
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button onPress={onClose}>Cerrar</Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* =======================
 * Inputs pequeños
 * ======================= */
const NumInput = ({
  label,
  value,
  onChange,
  style,
  keyboardType = 'numeric',
}: {
  label: string;
  value?: number | null;
  onChange: (n: number | undefined) => void;
  style?: any;
  keyboardType?: 'numeric' | 'default';
}) => (
  <TextInput
    mode="outlined"
    dense
    label={label}
    value={value == null || Number.isNaN(value) ? '' : String(value)}
    onChangeText={(t) => {
      const v = t.trim();
      if (!v.length) return onChange(undefined);
      const n = Number(v.replace(',', '.'));
      onChange(Number.isFinite(n) ? n : undefined);
    }}
    keyboardType={keyboardType}
    style={[{ width: 90 }, style]}
  />
);

/* =======================
 * Selector fecha/hora (2 pasos)
 * ======================= */
function DateTimeField({
  label,
  iso,
  onChangeISO,
}: {
  label: string;
  iso?: string;
  onChangeISO: (v?: string) => void;
}) {
  const [step, setStep] = useState<'closed' | 'date' | 'time'>('closed');
  const [tmp, setTmp] = useState<Date>(() => (iso ? new Date(iso) : new Date()));

  useEffect(() => {
    if (iso) setTmp(new Date(iso));
  }, [iso]);

  const open = () => setStep('date');
  const closeAll = () => setStep('closed');

  const onDatePicked = (_: DateTimePickerEvent, date?: Date) => {
    if (!date) { closeAll(); return; }
    const d = new Date(tmp);
    d.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setTmp(d);
    setStep('time');
  };

  const onTimePicked = (_: DateTimePickerEvent, date?: Date) => {
    if (!date) { closeAll(); return; }
    const d = new Date(tmp);
    d.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
    setTmp(d);
    onChangeISO(d.toISOString());
    closeAll();
  };

  const clear = () => {
    onChangeISO(undefined);
    closeAll();
  };

  return (
    <>
      <TextInput
        mode="outlined"
        label={label}
        value={iso ? new Date(iso).toLocaleString() : ''}
        editable={false}
        right={<TextInput.Icon icon="calendar" onPress={open} forceTextInputFocus={false} />}
        style={{ flex: 1, minWidth: 160 }}
      />

      {step !== 'closed' && (
        <Modal visible transparent animationType="fade" onRequestClose={closeAll} presentationStyle="overFullScreen">
          <TouchableWithoutFeedback onPress={closeAll}>
            <View style={styles.dialogOverlay} />
          </TouchableWithoutFeedback>

          <View style={styles.pickerCard}>
            <Text style={[styles.dialogTitle, styles.txt]}>{label}</Text>
            <Divider />
            <View style={{ marginTop: 8 }}>
              {step === 'date' && (
                <>
                  <Text style={[{ marginBottom: 4, color: '#666' }, styles.txt]}>Fecha</Text>
                  <DateTimePicker
                    value={tmp}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDatePicked}
                  />
                </>
              )}
              {step === 'time' && (
                <>
                  <Text style={[{ marginBottom: 4, color: '#666' }, styles.txt]}>Hora</Text>
                  <DateTimePicker
                    value={tmp}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onTimePicked}
                  />
                </>
              )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              {step === 'date' && <Button onPress={clear}>Limpiar</Button>}
              <Button onPress={closeAll}>Cerrar</Button>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

/* =======================
 * CierreEditor
 * ======================= */
type Props = {
  incendioId: string;
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export default function CierreEditor({ incendioId, visible, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [estadoCierre, setEstadoCierre] = useState<EstadoCierre>('Pendiente');

  // 👇 nuevo: estado admin
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const u = await getUser();
        setIsAdmin(!!u?.is_admin);
      } catch {}
    })();
  }, []);

  // Catálogos
  const [tiposIncendio, setTiposIncendio] = useState<CatalogoItem[]>([]);
  const [tiposPropiedad, setTiposPropiedad] = useState<CatalogoItem[]>([]);
  const [causas, setCausas] = useState<CatalogoItem[]>([]);
  const [iniciadoJuntoA, setIniciadoJuntoA] = useState<CatalogoItem[]>([]);
  const [mediosTerrestres, setMediosTerrestres] = useState<CatalogoItem[]>([]);
  const [mediosAereos, setMediosAereos] = useState<CatalogoItem[]>([]);
  const [mediosAcuaticos, setMediosAcuaticos] = useState<CatalogoItem[]>([]);
  const [abastos, setAbastos] = useState<CatalogoItem[]>([]);
  const [instituciones, setInstituciones] = useState<CatalogoItem[]>([]);
  const [tecnicasCat, setTecnicasCat] = useState<CatalogoItem[]>([]);

  const fetchAllCatalogs = useCallback(async () => {
    const [
      catTiposIncendio,
      catTiposPropiedad,
      catCausas,
      catIniciado,
      catTerrestres,
      catAereos,
      catAcuaticos,
      catAbastos,
      catInstituciones,
      catTecnicas,
    ] = await Promise.all([
      listCatalogoItems('tipos_incendio', { page: 1, pageSize: 200 }),
      listCatalogoItems('tipo_propiedad', { page: 1, pageSize: 200 }),
      listCatalogoItems('causas_catalogo', { page: 1, pageSize: 200 }),
      listCatalogoItems('iniciado_junto_a_catalogo', { page: 1, pageSize: 200 }),
      listCatalogoItems('medios_terrestres_catalogo', { page: 1, pageSize: 200 }),
      listCatalogoItems('medios_aereos_catalogo', { page: 1, pageSize: 200 }),
      listCatalogoItems('medios_acuaticos_catalogo', { page: 1, pageSize: 200 }),
      listCatalogoItems('abastos_catalogo', { page: 1, pageSize: 200 }),
      listCatalogoItems('instituciones', { page: 1, pageSize: 200 }),
      listCatalogoItems('tecnicas_extincion_catalogo', { page: 1, pageSize: 200 }),
    ]);

    const cats = {
      tiposIncendio: catTiposIncendio.items ?? [],
      tiposPropiedad: catTiposPropiedad.items ?? [],
      causas: catCausas.items ?? [],
      iniciadoJuntoA: catIniciado.items ?? [],
      mediosTerrestres: catTerrestres.items ?? [],
      mediosAereos: catAereos.items ?? [],
      mediosAcuaticos: catAcuaticos.items ?? [],
      abastos: catAbastos.items ?? [],
      instituciones: catInstituciones.items ?? [],
      tecnicasCat: catTecnicas.items ?? [],
    };

    setTiposIncendio(cats.tiposIncendio);
    setTiposPropiedad(cats.tiposPropiedad);
    setCausas(cats.causas);
    setIniciadoJuntoA(cats.iniciadoJuntoA);
    setMediosTerrestres(cats.mediosTerrestres);
    setMediosAereos(cats.mediosAereos);
    setMediosAcuaticos(cats.mediosAcuaticos);
    setAbastos(cats.abastos);
    setInstituciones(cats.instituciones);
    setTecnicasCat(cats.tecnicasCat);

    return cats;
  }, []);

  // Form
  const [tipoPrincipalId, setTipoPrincipalId] = useState<string | undefined>(undefined);

  const [compById, setCompById] = useState<Record<string, number>>({});
  const compArray = useMemo(
    () =>
      Object.entries(compById)
        .filter(([_, pct]) => typeof pct === 'number' && Number(pct) > 0)
        .map(([tipo_incendio_id, pct]) => ({ tipo_incendio_id, pct: Number(pct) })),
    [compById]
  );

  const [topoPlano, setTopoPlano] = useState<number | undefined>(undefined);
  const [topoOndulado, setTopoOndulado] = useState<number | undefined>(undefined);
  const [topoQuebrado, setTopoQuebrado] = useState<number | undefined>(undefined);

  const [propSel, setPropSel] = useState<Record<string, boolean>>({});

  const [iniciadoId, setIniciadoId] = useState<string | undefined>(undefined);
  const [iniciadoOtro, setIniciadoOtro] = useState<string | undefined>(undefined);

  const [scTer, setScTer] = useState<string | undefined>(undefined);
  const [scAer, setScAer] = useState<string | undefined>(undefined);
  const [scCtrl, setScCtrl] = useState<string | undefined>(undefined);
  const [scExt, setScExt] = useState<string | undefined>(undefined);

  const [supTotal, setSupTotal] = useState<number | undefined>(undefined);
  const [supDentro, setSupDentro] = useState<number | undefined>(undefined);
  const [supFuera, setSupFuera] = useState<number | undefined>(undefined);
  const [supNombreAP, setSupNombreAP] = useState<string | undefined>(undefined);

  useEffect(() => {
    const total =
      (typeof supDentro === 'number' ? supDentro : 0) +
      (typeof supFuera === 'number' ? supFuera : 0);
    if (typeof supDentro !== 'number' && typeof supFuera !== 'number') {
      setSupTotal(undefined);
    } else {
      setSupTotal(total);
    }
  }, [supDentro, supFuera]);

  type SVRow = {
    ubicacion: 'DENTRO_AP' | 'FUERA_AP';
    categoria: 'bosque_natural' | 'plantacion_forestal' | 'otra_vegetacion';
    subtipo?: string | null;
    area_ha: number;
  };
  const [sv, setSv] = useState<SVRow[]>([]);

  const [tecById, setTecById] = useState<Record<string, number>>({});

  const [medTerCant, setMedTerCant] = useState<Record<string, number>>({});
  const [medAerPct, setMedAerPct] = useState<Record<string, number>>({});
  const [medAcuCant, setMedAcuCant] = useState<Record<string, number>>({});
  const [instSel, setInstSel] = useState<Set<string>>(new Set());

  const [abastoCant, setAbastoCant] = useState<Record<string, number>>({});

  const [causaId, setCausaId] = useState<string | undefined>(undefined);
  const [causaOtro, setCausaOtro] = useState<string | undefined>(undefined);

  const [tempC, setTempC] = useState<number | undefined>(undefined);
  const [hrPct, setHrPct] = useState<number | undefined>(undefined);
  const [vientoVel, setVientoVel] = useState<number | undefined>(undefined);
  const [vientoDir, setVientoDir] = useState<string | undefined>(undefined);

  const [nota, setNota] = useState<string>('');

  const [dlgTipoOpen, setDlgTipoOpen] = useState(false);
  const [dlgIniciadoOpen, setDlgIniciadoOpen] = useState(false);
  const [dlgCausaOpen, setDlgCausaOpen] = useState(false);

  const sumValues = (obj: Record<string, number>) =>
    Object.values(obj).reduce((acc, n) => acc + (Number.isFinite(n) ? Number(n) : 0), 0);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const cats = await fetchAllCatalogs();
      const c = await getCierre(incendioId);

      setEstadoCierre(c.estado_cierre);

      setTipoPrincipalId(c?.tipo_incendio_principal?.id ?? undefined);

      const comp: Record<string, number> = {};
      for (const it of c.composicion_tipo || []) comp[it.tipo_incendio_id] = Number(it.pct || 0);
      setCompById(comp);

      setTopoPlano(c.topografia?.plano_pct ?? undefined);
      setTopoOndulado(c.topografia?.ondulado_pct ?? undefined);
      setTopoQuebrado(c.topografia?.quebrado_pct ?? undefined);

      const pr: Record<string, boolean> = {};
      for (const p of c.propiedad || []) pr[p.tipo_propiedad_id] = !!p.usado;
      setPropSel(pr);

      setIniciadoId(c.iniciado_junto_a?.iniciado_id ?? undefined);
      setIniciadoOtro(c.iniciado_junto_a?.otro_texto ?? undefined);

      setScTer(c.secuencia_control?.llegada_medios_terrestres_at ?? undefined);
      setScAer(c.secuencia_control?.llegada_medios_aereos_at ?? undefined);
      setScCtrl(c.secuencia_control?.controlado_at ?? undefined);
      setScExt(c.secuencia_control?.extinguido_at ?? undefined);

      setSupTotal(c.superficie?.area_total_ha ?? undefined);
      setSupDentro(c.superficie?.dentro_ap_ha ?? undefined);
      setSupFuera(c.superficie?.fuera_ap_ha ?? undefined);
      setSupNombreAP(c.superficie?.nombre_ap ?? undefined);

      setSv([]);

      const tb: Record<string, number> = {};
      for (const t of c.tecnicas || []) {
        const slug = (t as any).tecnica as TecnicaSlug | undefined;
        if (!slug) continue;
        const id = tecnicaIdFromSlug(slug, cats.tecnicasCat);
        if (id) tb[id] = Number((t as any).pct || 0);
      }
      setTecById(tb);

      const mt: Record<string, number> = {};
      (c.medios?.terrestres || []).forEach((m) => (mt[m.medio_terrestre_id] = Number(m.cantidad || 0)));
      setMedTerCant(mt);

      const ma: Record<string, number> = {};
      (c.medios?.aereos || []).forEach((m) => (ma[m.medio_aereo_id] = Number(m.pct || 0)));
      setMedAerPct(ma);

      const mac: Record<string, number> = {};
      (c.medios?.acuaticos || []).forEach((m) => (mac[m.medio_acuatico_id] = Number(m.cantidad || 0)));
      setMedAcuCant(mac);

      const inst = new Set<string>();
      (c.medios?.instituciones || []).forEach((i) => inst.add(i.institucion_uuid));
      setInstSel(inst);

      const ab: Record<string, number> = {};
      (c.abastos || []).forEach((a) => (ab[a.abasto_id] = Number(a.cantidad || 0)));
      setAbastoCant(ab);

      setCausaId(c.causa?.causa_id ?? undefined);
      setCausaOtro(c.causa?.otro_texto ?? undefined);

      setTempC(c.meteo?.temp_c ?? undefined);
      setHrPct(c.meteo?.hr_pct ?? undefined);
      setVientoVel(c.meteo?.viento_vel ?? undefined);
      setVientoDir(c.meteo?.viento_dir ?? undefined);

      setNota('');
    } finally {
      setLoading(false);
    }
  }, [incendioId, fetchAllCatalogs]);

  useEffect(() => {
    if (visible) reload();
  }, [visible, reload]);

  const buildPayload = useCallback(() => {
    const payload: any = {};

    if (tipoPrincipalId) payload.tipo_incendio_principal_id = tipoPrincipalId;
    if (compArray.length) payload.composicion_tipo = compArray;

    if (topoPlano != null || topoOndulado != null || topoQuebrado != null) {
      payload.topografia = {
        ...(typeof topoPlano === 'number' ? { plano_pct: topoPlano } : {}),
        ...(typeof topoOndulado === 'number' ? { ondulado_pct: topoOndulado } : {}),
        ...(typeof topoQuebrado === 'number' ? { quebrado_pct: topoQuebrado } : {}),
      };
    }

    const propArr = Object.entries(propSel).map(([tipo_propiedad_id, usado]) => ({ tipo_propiedad_id, usado }));
    if (propArr.length) payload.propiedad = propArr;

    if (iniciadoId || (iniciadoOtro && iniciadoOtro.length)) {
      payload.iniciado_junto_a = {
        ...(iniciadoId ? { iniciado_id: iniciadoId } : {}),
        ...(typeof iniciadoOtro === 'string' ? { otro_texto: iniciadoOtro } : {}),
      };
    }

    if (scTer || scAer || scCtrl || scExt) {
      payload.secuencia_control = {
        ...(scTer ? { llegada_medios_terrestres_at: scTer } : {}),
        ...(scAer ? { llegada_medios_aereos_at: scAer } : {}),
        ...(scCtrl ? { controlado_at: scCtrl } : {}),
        ...(scExt ? { extinguido_at: scExt } : {}),
      };
    }

    if (supTotal != null || supDentro != null || supFuera != null || (supNombreAP && supNombreAP.length)) {
      payload.superficie = {
        ...(typeof supTotal === 'number' ? { area_total_ha: supTotal } : {}),
        ...(typeof supDentro === 'number' ? { dentro_ap_ha: supDentro } : {}),
        ...(typeof supFuera === 'number' ? { fuera_ap_ha: supFuera } : {}),
        ...(typeof supNombreAP === 'string' ? { nombre_ap: supNombreAP } : {}),
      };
    }

    if (sv.length) payload.superficie_vegetacion = sv;

    // === Técnicas: mapeo robusto y suma por slug ===
    const tecBySlug: Record<TecnicaSlug, number> = {
      directo: 0,
      indirecto: 0,
      control_natural: 0,
    } as Record<TecnicaSlug, number>;

    for (const [id, pct0] of Object.entries(tecById)) {
      const pct = Number(pct0);
      if (!Number.isFinite(pct) || pct <= 0) continue;
      const nombre = tecnicasCat.find((t) => t.id === id)?.nombre;
      const slug = tecnicaSlugFromNombre(nombre);
        console.log('[BUILD_PAYLOAD][TECNICA]', { id, nombre, slug, pct }); // 👈 log clave

      if (isTecnicaSlug(slug)) {
        tecBySlug[slug] = (tecBySlug[slug] || 0) + pct;
      }
    }


    const tecArr = (Object.entries(tecBySlug) as [TecnicaSlug, number][])
      .filter(([, pct]) => pct > 0)
      .map(([slug, pct]) => ({ tecnica: slug, pct: Number(pct) }));

    if (tecArr.length) payload.tecnicas = tecArr;
    // === /Técnicas ===

    const mtArr = Object.entries(medTerCant)
      .filter(([_, c]) => Number(c) > 0)
      .map(([medio_terrestre_id, cantidad]) => ({ medio_terrestre_id, cantidad: Number(cantidad) }));
    if (mtArr.length) payload.medios_terrestres = mtArr;

    const maArr = Object.entries(medAerPct)
      .filter(([_, p]) => Number(p) > 0)
      .map(([medio_aereo_id, pct]) => ({ medio_aereo_id, pct: Number(pct) }));
    if (maArr.length) payload.medios_aereos = maArr;

    const macArr = Object.entries(medAcuCant)
      .filter(([_, c]) => Number(c) > 0)
      .map(([medio_acuatico_id, cantidad]) => ({ medio_acuatico_id, cantidad: Number(cantidad) }));
    if (macArr.length) payload.medios_acuaticos = macArr;

    const instArr = Array.from(instSel).map((institucion_uuid) => ({ institucion_uuid }));
    if (instArr.length) payload.medios_instituciones = instArr;

    const abArr = Object.entries(abastoCant)
      .filter(([_, c]) => Number(c) > 0)
      .map(([abasto_id, cantidad]) => ({ abasto_id, cantidad: Number(cantidad) }));
    if (abArr.length) payload.abastos = abArr;

    if (causaId || (causaOtro && causaOtro.length)) {
      payload.causa = {
        ...(causaId ? { causa_id: causaId } : {}),
        ...(typeof causaOtro === 'string' ? { otro_texto: causaOtro } : {}),
      };
    }

    if (
      typeof tempC === 'number' ||
      typeof hrPct === 'number' ||
      typeof vientoVel === 'number' ||
      typeof vientoDir === 'string'
    ) {
      payload.meteo = {
        ...(typeof tempC === 'number' ? { temp_c: tempC } : {}),
        ...(typeof hrPct === 'number' ? { hr_pct: hrPct } : {}),
        ...(typeof vientoVel === 'number' ? { viento_vel: vientoVel } : {}),
        ...(typeof vientoDir === 'string' ? { viento_dir: vientoDir } : {}),
      };
    }

    if (nota && nota.trim().length) payload.nota = nota.trim();

    return payload;
  }, [
    tipoPrincipalId,
    compArray,
    topoPlano,
    topoOndulado,
    topoQuebrado,
    propSel,
    iniciadoId,
    iniciadoOtro,
    scTer,
    scAer,
    scCtrl,
    scExt,
    supTotal,
    supDentro,
    supFuera,
    supNombreAP,
    sv,
    medTerCant,
    medAerPct,
    medAcuCant,
    instSel,
    abastoCant,
    causaId,
    causaOtro,
    tempC,
    hrPct,
    vientoVel,
    vientoDir,
    nota,
    tecById,
    tecnicasCat
  ]);

  const validateBeforeSave = useCallback(() => {
    const sumTec = sumValues(tecById);
    if (sumTec > 100.0001) {
      Alert.alert('Revisa técnicas', `La suma de técnicas es ${sumTec}%. Debe ser ≤ 100%.`);
      return false;
    }
    const sumAer = sumValues(medAerPct);
    if (sumAer > 100.0001) {
      Alert.alert('Revisa medios aéreos', `La suma de porcentajes aéreos es ${sumAer}%. Debe ser ≤ 100%.`);
      return false;
    }
    const sumComp = sumValues(compById);
    if (sumComp > 100.0001) {
      Alert.alert('Revisa composición por tipo', `La suma de composición es ${sumComp}%. Debe ser ≤ 100%.`);
      return false;
    }
    const sumTopo =
      (typeof topoPlano === 'number' ? topoPlano : 0) +
      (typeof topoOndulado === 'number' ? topoOndulado : 0) +
      (typeof topoQuebrado === 'number' ? topoQuebrado : 0);
    if (sumTopo > 100.0001) {
      Alert.alert('Revisa topografía', `La suma de topografía es ${sumTopo}%. Debe ser ≤ 100%.`);
      return false;
    }
    return true;
  }, [tecById, medAerPct, compById, topoPlano, topoOndulado, topoQuebrado]);

  const handleSave = useCallback(async () => {
    if (estadoCierre === 'Extinguido' && !isAdmin) {
      Alert.alert('No permitido', 'Este cierre está extinguido. Solo un administrador puede modificarlo.');
      return;
    }
    try {
      if (!validateBeforeSave()) return;
      setSaving(true);
      const payload = buildPayload();

      // 👇 Log para depurar lo que realmente enviamos
      console.log('[CIERRE][PATCH] tecnicas ->', payload.tecnicas);

      await patchCierreCatalogos(incendioId, payload);
      onSaved?.();
    } catch (e: any) {
      console.error('[CIERRE][PATCH][ERROR]', e?.response?.status, e?.response?.data || e);
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        'No se pudo guardar';
      Alert.alert('Error', String(msg));
    } finally {
      setSaving(false);
    }
  }, [buildPayload, incendioId, onSaved, validateBeforeSave, estadoCierre, isAdmin]);

  const handleFinalizar = useCallback(async () => {
    try {
      setClosing(true);
      await finalizarCierre(incendioId);
      await reload();
      onSaved?.();
    } catch (e: any) {
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        'No se pudo finalizar';
      Alert.alert('Error', String(msg));
    } finally {
      setClosing(false);
    }
  }, [incendioId, reload, onSaved]);

  const handleReabrir = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert('No permitido', 'Solo un administrador puede reabrir un cierre extinguido.');
      return;
    }
    try {
      setClosing(true);
      await reabrirCierre(incendioId);
      await reload();
      onSaved?.();
    } catch (e: any) {
      const msg =
        e?.response?.data?.error?.message ||
        e?.response?.data?.message ||
        e?.message ||
        'No se pudo reabrir';
      Alert.alert('Error', String(msg));
    } finally {
      setClosing(false);
    }
  }, [incendioId, reload, onSaved, isAdmin]);

  const tipoPrincipalNombre = useMemo(
    () => tiposIncendio.find((t) => t.id === tipoPrincipalId)?.nombre || 'Seleccionar…',
    [tiposIncendio, tipoPrincipalId]
  );
  const iniciadoNombre = useMemo(
    () => iniciadoJuntoA.find((i) => i.id === iniciadoId)?.nombre || 'Seleccionar…',
    [iniciadoJuntoA, iniciadoId]
  );
  const causaNombre = useMemo(
    () => causas.find((c) => c.id === causaId)?.nombre || 'Seleccionar…',
    [causas, causaId]
  );

  const ChipToggle = ({
    label,
    value,
    onToggle,
  }: {
    label: string;
    value: boolean;
    onToggle: (v: boolean) => void;
  }) => (
    <Chip
      mode="outlined"
      selected={value}
      selectedColor="#2E7D32"
      onPress={() => onToggle(!value)}
      style={[
        styles.chip,
        value ? { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' } : undefined,
      ]}
      textStyle={styles.txt}
    >
      {label}
    </Chip>
  );

  const dentroPctText = useMemo(() => {
    if (typeof supTotal !== 'number' || supTotal <= 0 || typeof supDentro !== 'number') return '—';
    const pct = (supDentro / supTotal) * 100;
    return `${pct.toFixed(1)}%`;
  }, [supTotal, supDentro]);

  const fueraPctText = useMemo(() => {
    if (typeof supTotal !== 'number' || supTotal <= 0 || typeof supFuera !== 'number') return '—';
    const pct = (supFuera / supTotal) * 100;
    return `${pct.toFixed(1)}%`;
  }, [supTotal, supFuera]);

  const isClosed = estadoCierre === 'Extinguido';
  const showSaveBtn = !isClosed || isAdmin;
  const showReopenBtn = isClosed && isAdmin;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={[styles.title, styles.txt]}>Cierre del incendio</Text>
          <View style={{ flex: 1 }} />
          <Chip style={{ backgroundColor: '#eee' }} textStyle={styles.txt}>
            Estado: {estadoCierre}
          </Chip>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator />
            <Text style={[{ marginTop: 8 }, styles.txt]}>Cargando…</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
            {/* Tipo principal */}
            <Text style={[styles.section, styles.txt]}>Tipo de incendio principal</Text>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Chip
                mode="outlined"
                icon="chevron-down"
                onPress={() => setDlgTipoOpen(true)}
                textStyle={styles.txt}
              >
                {tipoPrincipalNombre}
              </Chip>
              {!!tipoPrincipalId && (
                <Button onPress={() => setTipoPrincipalId(undefined)}>Quitar</Button>
              )}
            </View>

            {/* Composición por tipo */}
            <Text style={[styles.section, styles.txt]}>Composición por tipo (%)</Text>
            <HelperText type="info" style={{ marginHorizontal: 16 }}>
              Indica el porcentaje por tipo. Ej: Pino 70% • Matorral 30%.
            </HelperText>
            <View style={styles.wrap}>
              {tiposIncendio.map((t) => (
                <View key={t.id} style={styles.compCell}>
                  <Text numberOfLines={1} style={[styles.compLabel, styles.txt]}>
                    {t.nombre}
                  </Text>
                  <NumInput
                    label="%"
                    value={compById[t.id] ?? undefined}
                    onChange={(n) =>
                      setCompById((prev) => ({ ...prev, [t.id]: typeof n === 'number' ? n : 0 }))
                    }
                    style={{ width: 80 }}
                  />
                </View>
              ))}
            </View>

            <Divider style={styles.sep} />

            {/* Topografía */}
            <Text style={[styles.section, styles.txt]}>Topografía (%)</Text>
            <View style={styles.row}>
              <NumInput label="Plano" value={topoPlano ?? undefined} onChange={setTopoPlano} />
              <NumInput label="Ondulado" value={topoOndulado ?? undefined} onChange={setTopoOndulado} />
              <NumInput label="Quebrado" value={topoQuebrado ?? undefined} onChange={setTopoQuebrado} />
            </View>

            <Divider style={styles.sep} />

            {/* Propiedad */}
            <Text style={[styles.section, styles.txt]}>Tipo de propiedad</Text>
            <View style={styles.wrap}>
              {tiposPropiedad.map((p) => (
                <ChipToggle
                  key={p.id}
                  label={p.nombre}
                  value={!!propSel[p.id]}
                  onToggle={(v) => setPropSel((prev) => ({ ...prev, [p.id]: v }))}
                />
              ))}
            </View>

            <Divider style={styles.sep} />

            {/* Iniciado junto a */}
            <Text style={[styles.section, styles.txt]}>Iniciado junto a</Text>
            <View style={[styles.row, { alignItems: 'stretch' }]}>
              <Chip
                mode="outlined"
                icon="chevron-down"
                onPress={() => setDlgIniciadoOpen(true)}
                textStyle={styles.txt}
              >
                {iniciadoNombre}
              </Chip>
              <TextInput
                mode="outlined"
                dense
                label="Otro (texto)"
                value={iniciadoOtro ?? ''}
                onChangeText={(t) => setIniciadoOtro(t || undefined)}
                style={{ flex: 1 }}
              />
            </View>

            <Divider style={styles.sep} />

            {/* Secuencia de control */}
            <Text style={[styles.section, styles.txt]}>Secuencia de control</Text>
            <HelperText type="info" style={{ marginHorizontal: 16 }}>
              Primero se elige la fecha y luego la hora. Se guardará en ISO.
            </HelperText>
            <View style={styles.row}>
              <DateTimeField label="Llegada medios terrestres" iso={scTer} onChangeISO={setScTer} />
              <DateTimeField label="Llegada medios aéreos" iso={scAer} onChangeISO={setScAer} />
            </View>
            <View style={styles.row}>
              <DateTimeField label="Controlado" iso={scCtrl} onChangeISO={setScCtrl} />
              <DateTimeField label="Extinguido" iso={scExt} onChangeISO={setScExt} />
            </View>

            <Divider style={styles.sep} />

            {/* Superficie */}
            <Text style={[styles.section, styles.txt]}>Superficie (ha)</Text>
            <View style={styles.row}>
              <TextInput
                mode="outlined"
                dense
                label="Total (auto)"
                value={typeof supTotal === 'number' ? String(supTotal) : ''}
                editable={false}
                right={<TextInput.Icon icon="information-outline" />}
                style={{ width: 110 }}
              />
              <NumInput label="Dentro AP" value={supDentro} onChange={setSupDentro} />
              <NumInput label="Fuera AP" value={supFuera} onChange={setSupFuera} />
            </View>
            <View style={[styles.row, { marginTop: 4 }]}>
              <TextInput
                mode="outlined"
                dense
                label="Área protegida (nombre)"
                value={supNombreAP ?? ''}
                onChangeText={(t) => setSupNombreAP(t || undefined)}
                style={{ flex: 1, minWidth: 200 }}
              />
            </View>
            <View style={[styles.row, { marginTop: 6 }]}>
              <Text style={styles.txt}>
                % Dentro AP: <Text style={{ fontWeight: 'bold' }}>{dentroPctText}</Text>
              </Text>
              <Text style={styles.txt}>
                % Fuera AP: <Text style={{ fontWeight: 'bold' }}>{fueraPctText}</Text>
              </Text>
            </View>

            <Divider style={styles.sep} />

            {/* Superficie por vegetación */}
            <Text style={[styles.section, styles.txt]}>Superficie por vegetación</Text>
            {sv.map((row, idx) => (
              <View key={idx} style={[styles.cardRow, { marginHorizontal: 16 }]}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={[styles.smallLabel, styles.txt]}>Ubicación:</Text>
                    {(['DENTRO_AP', 'FUERA_AP'] as const).map((u) => (
                      <Chip
                        key={u}
                        mode="outlined"
                        selected={row.ubicacion === u}
                        selectedColor="#2E7D32"
                        onPress={() =>
                          setSv((prev) => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], ubicacion: u };
                            return copy;
                          })
                        }
                        style={[
                          styles.chip,
                          u === row.ubicacion ? { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' } : undefined,
                        ]}
                        textStyle={styles.txt}
                      >
                        {u === 'DENTRO_AP' ? 'Dentro AP' : 'Fuera AP'}
                      </Chip>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={[styles.smallLabel, styles.txt]}>Categoría:</Text>
                    {(['bosque_natural', 'plantacion_forestal', 'otra_vegetacion'] as const).map((categ) => (
                      <Chip
                        key={categ}
                        mode="outlined"
                        selected={row.categoria === categ}
                        selectedColor="#2E7D32"
                        onPress={() =>
                          setSv((prev) => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], categoria: categ };
                            return copy;
                          })
                        }
                        style={[
                          styles.chip,
                          categ === row.categoria ? { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' } : undefined,
                        ]}
                        textStyle={styles.txt}
                      >
                        {categ === 'bosque_natural'
                          ? 'Bosque natural'
                          : categ === 'plantacion_forestal'
                          ? 'Plantación forestal'
                          : 'Otra vegetación'}
                      </Chip>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <TextInput
                      mode="outlined"
                      dense
                      label="Subtipo"
                      value={row.subtipo ?? ''}
                      onChangeText={(t) =>
                        setSv((prev) => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], subtipo: t || undefined };
                          return copy;
                        })
                      }
                      style={{ minWidth: 160, flexGrow: 1 }}
                    />
                    <NumInput
                      label="Área (ha)"
                      value={row.area_ha}
                      onChange={(n) =>
                        setSv((prev) => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], area_ha: Number(n || 0) };
                          return copy;
                        })
                      }
                      style={{ width: 120 }}
                    />
                    <Button
                      mode="text"
                      onPress={() =>
                        setSv((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      Quitar
                    </Button>
                  </View>
                </View>
              </View>
            ))}
            <View style={[styles.row, { justifyContent: 'flex-start' }]}>
              <Chip
                icon="plus"
                mode="outlined"
                onPress={() =>
                  setSv((prev) => [
                    ...prev,
                    { ubicacion: 'DENTRO_AP', categoria: 'bosque_natural', area_ha: 0 },
                  ])
                }
                textStyle={styles.txt}
              >
                Agregar fila
              </Chip>
            </View>

            <Divider style={styles.sep} />

            {/* Técnicas */}
            <Text style={[styles.section, styles.txt]}>Técnicas (%)</Text>
            {tecnicasCat.map((t) => (
              <View key={t.id} style={[styles.compRow, styles.cardRow]}>
                <Text style={[{ flex: 1, minWidth: 120 }, styles.txt]} numberOfLines={1}>{t.nombre}</Text>
                <NumInput
                  label="%"
                  value={tecById[t.id] ?? undefined}
                  onChange={(n) =>
                    setTecById((prev) => ({ ...prev, [t.id]: typeof n === 'number' ? n : 0 }))
                  }
                  style={{ width: 80 }}
                />
              </View>
            ))}

            <Divider style={styles.sep} />

            {/* Medios */}
            <Text style={[styles.section, styles.txt]}>Medios terrestres (cantidad)</Text>
            {mediosTerrestres.map((m) => (
              <View key={m.id} style={[styles.compRow, styles.cardRow]}>
                <Text style={[{ flex: 1, minWidth: 120 }, styles.txt]} numberOfLines={1}>{m.nombre}</Text>
                <NumInput
                  label="Cant."
                  value={medTerCant[m.id] ?? undefined}
                  onChange={(n) =>
                    setMedTerCant((prev) => ({ ...prev, [m.id]: typeof n === 'number' ? n : 0 }))
                  }
                  style={{ width: 80 }}
                />
              </View>
            ))}

            <Text style={[styles.section, styles.txt]}>Medios aéreos (%)</Text>
            {mediosAereos.map((m) => (
              <View key={m.id} style={[styles.compRow, styles.cardRow]}>
                <Text style={[{ flex: 1, minWidth: 120 }, styles.txt]} numberOfLines={1}>{m.nombre}</Text>
                <NumInput
                  label="%"
                  value={medAerPct[m.id] ?? undefined}
                  onChange={(n) =>
                    setMedAerPct((prev) => ({ ...prev, [m.id]: typeof n === 'number' ? n : 0 }))
                  }
                  style={{ width: 80 }}
                />
              </View>
            ))}

            <Text style={[styles.section, styles.txt]}>Medios acuáticos (cantidad)</Text>
            {mediosAcuaticos.map((m) => (
              <View key={m.id} style={[styles.compRow, styles.cardRow]}>
                <Text style={[{ flex: 1, minWidth: 120 }, styles.txt]} numberOfLines={1}>{m.nombre}</Text>
                <NumInput
                  label="Cant."
                  value={medAcuCant[m.id] ?? undefined}
                  onChange={(n) =>
                    setMedAcuCant((prev) => ({ ...prev, [m.id]: typeof n === 'number' ? n : 0 }))
                  }
                  style={{ width: 80 }}
                />
              </View>
            ))}

            <Divider style={styles.sep} />

            {/* Instituciones */}
            <Text style={[styles.section, styles.txt]}>Instituciones</Text>
            <View style={styles.wrap}>
              {instituciones.map((i) => {
                const checked = instSel.has(i.id);
                return (
                  <Chip
                    key={i.id}
                    mode="outlined"
                    selected={checked}
                    selectedColor="#2E7D32"
                    onPress={() =>
                      setInstSel((prev) => {
                        const s = new Set(prev);
                        checked ? s.delete(i.id) : s.add(i.id);
                        return s;
                      })
                    }
                    style={[
                      styles.chip,
                      checked ? { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' } : undefined,
                    ]}
                    textStyle={styles.txt}
                  >
                    {i.nombre}
                  </Chip>
                );
              })}
            </View>

            <Divider style={styles.sep} />

            {/* Abastos */}
            <Text style={[styles.section, styles.txt]}>Abastos</Text>
            {abastos.map((a) => (
              <View key={a.id} style={[styles.compRow, styles.cardRow]}>
                <Text style={[{ flex: 1, minWidth: 120 }, styles.txt]} numberOfLines={1}>{a.nombre}</Text>
                <NumInput
                  label="Cantidad"
                  value={abastoCant[a.id] ?? undefined}
                  onChange={(n) =>
                    setAbastoCant((prev) => ({ ...prev, [a.id]: typeof n === 'number' ? n : 0 }))
                  }
                  style={{ width: 100 }}
                />
              </View>
            ))}

            <Divider style={styles.sep} />

            {/* Causa */}
            <Text style={[styles.section, styles.txt]}>Causa</Text>
            <View style={[styles.row, { alignItems: 'stretch' }]}>
              <Chip
                mode="outlined"
                icon="chevron-down"
                onPress={() => setDlgCausaOpen(true)}
                textStyle={styles.txt}
              >
                {causaNombre}
              </Chip>
              <TextInput
                mode="outlined"
                dense
                label="Otro (texto)"
                value={causaOtro ?? ''}
                onChangeText={(t) => setCausaOtro(t || undefined)}
                style={{ flex: 1 }}
              />
            </View>

            <Divider style={styles.sep} />

            {/* Meteo */}
            <Text style={[styles.section, styles.txt]}>Meteorología</Text>
            <View style={styles.row}>
              <NumInput label="Temp (°C)" value={tempC} onChange={setTempC} />
              <NumInput label="HR (%)" value={hrPct} onChange={setHrPct} />
              <NumInput label="Viento (vel)" value={vientoVel} onChange={setVientoVel} />
              <TextInput
                mode="outlined"
                dense
                label="Viento (dir)"
                value={vientoDir ?? ''}
                onChangeText={(t) => setVientoDir(t || undefined)}
                style={{ width: 125}}
              />
            </View>

            <Divider style={styles.sepLarge} />

            {/* Nota */}
            <Text style={[styles.section, styles.txt]}>Nota / comentario</Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="Comentario breve para el feed de actualizaciones"
              value={nota}
              onChangeText={setNota}
              style={{ marginHorizontal: 16 }}
            />

            <View style={{ height: 24 }} />
          </ScrollView>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Button onPress={onClose} disabled={saving || closing}>
            Cerrar
          </Button>
          <View style={{ flex: 1 }} />

          {showReopenBtn && (
            <Button
              mode="contained-tonal"
              onPress={handleReabrir}
              loading={closing && isClosed}
              disabled={saving || closing}
              style={{ marginRight: 8 }}
            >
              Reabrir
            </Button>
          )}

          {showSaveBtn && (
            <Button
              mode="contained"
              onPress={handleSave}
              loading={saving}
              disabled={closing || saving}
              style={{ marginRight: 8 }}
            >
              Guardar
            </Button>
          )}

          {/* Finalizar: ya queda deshabilitado cuando está cerrado */}
          <Button
            mode="contained"
            onPress={handleFinalizar}
            loading={closing && !isClosed}
            disabled={saving || closing || isClosed}
            buttonColor="#2E7D32"
            textColor="#fff"
          >
            Finalizar
          </Button>
        </View>
      </View>

      {/* Diálogos */}
      <SelectDialog
        visible={dlgTipoOpen}
        title="Tipo de incendio principal"
        options={tiposIncendio}
        selectedId={tipoPrincipalId}
        onSelect={(id) => {
          setTipoPrincipalId(id);
          setDlgTipoOpen(false);
        }}
        onClose={() => setDlgTipoOpen(false)}
      />
      <SelectDialog
        visible={dlgIniciadoOpen}
        title="Iniciado junto a"
        options={iniciadoJuntoA}
        selectedId={iniciadoId}
        onSelect={(id) => {
          setIniciadoId(id);
          setDlgIniciadoOpen(false);
        }}
        onClose={() => setDlgIniciadoOpen(false)}
      />
      <SelectDialog
        visible={dlgCausaOpen}
        title="Causa probable"
        options={causas}
        selectedId={causaId}
        onSelect={(id) => {
          setCausaId(id);
          setDlgCausaOpen(false);
        }}
        onClose={() => setDlgCausaOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  txt: { color: '#111' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0, top: Platform.OS === 'ios' ? 60 : 30,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 12 },
    }),
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  title: { fontSize: 18, fontWeight: 'bold' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  section: { marginTop: 14, marginHorizontal: 16, fontWeight: 'bold' },
  sep: { marginTop: 12, marginHorizontal: 16, backgroundColor: '#eee', height: StyleSheet.hairlineWidth },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: 8, gap: 8 },

  compRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 8, flexWrap: 'wrap' },
  compCell: {
    width: '48%',
    minWidth: 220,
    borderWidth: 1,
    borderColor: '#EEE',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
  },
  compLabel: { marginBottom: 6, fontSize: 12 },

  chip: { marginRight: 8, marginBottom: 8 },

  cardRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderColor: '#EEE',
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 8,
  },

  smallLabel: { color: '#666', fontSize: 12 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },

  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  dialogTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 6 },

  sepLarge: { marginTop: 125, marginHorizontal: 16, backgroundColor: '#eee', height: StyleSheet.hairlineWidth },

  pickerCard: {
    position: 'absolute',
    left: 16, right: 16, top: '22%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 16 },
    }),
  },
});
