import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center" dir="rtl">
      <span className="text-6xl">🔍</span>
      <h1 className="text-2xl font-bold text-gray-800">הדף לא נמצא</h1>
      <p className="text-gray-500">הכתובת שהוזנה אינה קיימת במערכת.</p>
      <Link to="/dashboard" className="text-blue-600 underline hover:text-blue-800">
        חזרה ללוח הבקרה
      </Link>
    </div>
  );
}
