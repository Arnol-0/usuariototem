import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey:            'AIzaSyDhyS2VRfJ0Bq8xWeee9Pec1ZufZdCc_CE',
  authDomain:        'servicio-totem.firebaseapp.com',
  projectId:         'servicio-totem',
  storageBucket:     'servicio-totem.firebasestorage.app',
  messagingSenderId: '294955699605',
  appId:             '1:294955699605:web:f10f5480b8dc583e7f3a9c',
  measurementId:     'G-VTMLWS8QPZ',
  databaseURL:       'https://servicio-totem-default-rtdb.firebaseio.com',
};

export const app       = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db        = getFirestore(app);
export const rtdb      = getDatabase(app);
