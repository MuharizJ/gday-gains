import { Card, CardHeader, CardContent } from '@mui/material';
export default function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardHeader title={title} sx={{ pb: 0 }} />
      <CardContent sx={{ pt: 2 }}>{children}</CardContent>
    </Card>
  );
}
