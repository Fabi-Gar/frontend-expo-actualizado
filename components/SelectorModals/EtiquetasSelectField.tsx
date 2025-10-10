import React, { useMemo, useState } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import MultiSelectModal, { MultiOption } from './MultiSelectModal';

export type Etiqueta = { id: string; nombre: string; eliminadoEn?: string | null };

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
  etiquetas: Etiqueta[];
  label?: string;
  error?: string;
  touched?: boolean;
  showCountOnly?: boolean;
  maxPreview?: number;
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
    () =>
      etiquetas.map((e) => ({
        id: e.id,
        label: e.nombre,
        disabled: !!e.eliminadoEn, // <-- en lugar de pasar eliminadoEn crudo
      })),
    [etiquetas]
  );

  const display = useMemo(() => {
    if (showCountOnly) {
      return value.length ? `${value.length} seleccionada(s)` : '';
    }
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
        onChange={(ids) => onChange(ids.map(String))}
        onClose={() => setOpen(false)}
        allowClear
        enableShowFilter={false}
        disableDeletedSelection={true}
      />
    </>
  );
}

const styles = StyleSheet.create({
  input: { marginBottom: 12, backgroundColor: '#fff' },
});
