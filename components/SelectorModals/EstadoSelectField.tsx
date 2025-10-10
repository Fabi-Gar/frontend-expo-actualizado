// components/SelectorModals/EstadoSelectField.tsx
import React, { useMemo, useState } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import SingleSelectModal, { SingleSelectOption } from './SingleSelectModal';

export type Estado = { id: string; nombre: string; color?: string | null };

type Props = {
  value: string;                           // UUID
  onChange: (id: string) => void;
  estados: Estado[];
  error?: string;
  touched?: boolean;
  label?: string;
  defaultId?: string;                      // opcional
};

export default function EstadoSelectField({
  value,
  onChange,
  estados,
  error,
  touched,
  label = 'Estado',
  defaultId,
}: Props) {
  const [open, setOpen] = useState(false);

  const options: SingleSelectOption[] = useMemo(
    () => estados.map((e) => ({ id: e.id, label: e.nombre })),
    [estados]
  );

  const display = useMemo(() => {
    const found = estados.find((e) => String(e.id) === String(value));
    return found?.nombre ?? '';
  }, [estados, value]);

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

      <SingleSelectModal
        visible={open}
        title="Selecciona estado"
        options={options}
        value={value || null}
        onSelect={(id) => onChange((id as string) ?? (defaultId ?? ''))}
        onClose={() => setOpen(false)}
        allowClear={false}
        defaultValue={defaultId}
      />
    </>
  );
}

const styles = StyleSheet.create({
  input: { marginBottom: 12, backgroundColor: '#fff' },
});
