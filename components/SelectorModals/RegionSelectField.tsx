// components/RegionSelectField.tsx
import React, { useMemo, useState } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import SingleSelectModal from './SingleSelectModal';
import { listRegiones } from '../../services/catalogos'; 

type Props = {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  error?: string;
  touched?: boolean;
  label?: string;
};

export default function RegionSelectFieldRemote({
  value,
  onChange,
  error,
  touched,
  label = 'Región',
}: Props) {
  const [open, setOpen] = useState(false);

  const display = useMemo(() => String(value ?? ''), [value]); 

  const regionesLoader = async ({ q, show }: { q: string; show: 'active' | 'deleted' | 'all' }) => {
    const params: any = { page: 1, limit: 50 };
    if (show !== 'active') params.show = show;
    if (q) params.q = q;

    const resp = await listRegiones(params);
    const items = Array.isArray(resp) ? resp : resp.items ?? [];
    return items.map((r: any) => ({
      id: r.id,
      label: r.nombre,
      eliminadoEn: r.eliminadoEn ?? null,
    }));
  };

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
        title="Selecciona región"
        value={value ?? null}
        onSelect={(id) => onChange((id as string) ?? null)}
        onClose={() => setOpen(false)}
        allowClear
        // modo remoto + UX
        loader={regionesLoader}
        enableSearch
        enableShowFilter
        disableDeletedSelection
      />
    </>
  );
}

const styles = StyleSheet.create({
  input: { marginBottom: 12, backgroundColor: '#fff' },
});
