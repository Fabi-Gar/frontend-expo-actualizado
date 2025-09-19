// components/RegionSelectField.tsx
import React, { useMemo, useState } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import SingleSelectModal, { SingleSelectOption } from './SingleSelectModal';

export type Region = { id: string; nombre: string };

type Props = {
  value: string | null | undefined;                
  onChange: (id: string | null) => void;           
  regions: Region[];                              
  error?: string;
  touched?: boolean;
  label?: string;
};

export default function RegionSelectField({
  value,
  onChange,
  regions,
  error,
  touched,
  label = 'Región',
}: Props) {
  const [open, setOpen] = useState(false);

  const options: SingleSelectOption[] = useMemo(
    () =>
      regions.map((r) => ({
        id: r.id,               // mantiene el UUID tal cual
        label: r.nombre,
      })),
    [regions]
  );

  const display = useMemo(() => {
    const found = regions.find((r) => r.id === (value ?? ''));
    return found?.nombre ?? '';
  }, [regions, value]);

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
          />
        </View>
      </TouchableOpacity>
      <HelperText type="error" visible={!!(touched && error)}>
        {error}
      </HelperText>

      <SingleSelectModal
        visible={open}
        title="Selecciona región"
        options={options}
        value={value ?? null}
        onSelect={(id) => onChange(id as string | null)} // devolvemos UUID (string) o null
        onClose={() => setOpen(false)}
        allowClear
      />
    </>
  );
}

const styles = StyleSheet.create({
  input: { marginBottom: 12, backgroundColor: '#fff' },
});
