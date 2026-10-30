import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClearStorage() {
  const navigate = useNavigate();

  const handleClear = () => {
    localStorage.clear();
    sessionStorage.clear();
    alert('Storage cleared! Redirecting to login...');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Clear Browser Storage</CardTitle>
          <CardDescription>
            This will clear all saved login data and cached information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            If you're experiencing login issues or seeing corrupted data, clearing your browser storage can help.
          </p>
          <Button onClick={handleClear} variant="destructive" className="w-full">
            Clear Storage & Logout
          </Button>
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">
            Go Back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
