import React, { useMemo, useState } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import MultiSelectModal, { MultiOption } from './MultiSelectModal';

export type Etiqueta = { id: number; nombre: string };

type Props = {
  value: number[];                       // ids seleccionados
  onChange: (ids: number[]) => void;     // setFieldValue('etiquetasIds', ids)
  etiquetas: Etiqueta[];
  label?: string;
  error?: string;
  touched?: boolean;
  showCountOnly?: boolean;               // si true, muestra "N seleccionadas"
  maxPreview?: number;                   // cuántos nombres mostrar antes de "y +N"
};

export default function EtiquetasSelectField({
  value,
  onChange,
  etiquetas,
  label = 'Etiquetas',
  error,
  touched,
  showCountOnly = true,
  maxPreview = 3,
}: Props) {
  const [open, setOpen] = useState(false);

  const options: MultiOption[] = useMemo(
    () => etiquetas.map((e) => ({ id: e.id, label: e.nombre })),
    [etiquetas]
  );

  const display = useMemo(() => {
    if (showCountOnly) {
      return value.length ? `${value.length} seleccionada(s)` : '';
    }
    // Mostrar nombres (hasta maxPreview) y luego “+N”
    const lookup = new Map(etiquetas.map((e) => [String(e.id), e.nombre]));
    const names = value.map((id) => lookup.get(String(id))).filter(Boolean) as string[];
    if (!names.length) return '';
    if (names.length <= maxPreview) return names.join(', ');
    const head = names.slice(0, maxPreview).join(', ');
    const rest = names.length - maxPreview;
    return `${head} y +${rest}`;
  }, [value, etiquetas, showCountOnly, maxPreview]);

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.7}>
        <View pointerEvents="none">
          <TextInput
            label={label}
            value={display}
            editable={false}
            right={<TextInput.Icon icon="menu-down" />}
            style={styles.input}
            error={!!(touched && error)}
            placeholder="Toca para seleccionar"
          />
        </View>
      </TouchableOpacity>
      <HelperText type="error" visible={!!(touched && error)}>
        {error}
      </HelperText>

      <MultiSelectModal
        visible={open}
        title="Selecciona etiquetas"
        options={options}
        value={value}
        onChange={(ids) => onChange(ids.map((x) => Number(x)))}
        onClose={() => setOpen(false)}
        allowClear
      />
    </>
  );
}

const styles = StyleSheet.create({
  input: { marginBottom: 12, backgroundColor: '#fff' },
});
