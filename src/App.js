import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut 
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    onSnapshot,
    doc,
    deleteDoc,
    updateDoc,
    query,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';

// --- IMPORTANT FIREBASE SETUP ---
// This is now connected to your Firebase project.

const firebaseConfig = {
  apiKey: "AIzaSyDqfTeMNCIOyiJ6ETlIbATfzVd-XQR1iUk",
  authDomain: "thefourthwall-cd8c2.firebaseapp.com",
  projectId: "thefourthwall-cd8c2",
  storageBucket: "thefourthwall-cd8c2.appspot.com",
  messagingSenderId: "915386524751",
  appId: "1:915386524751:web:6ba79bad8d0a8426c1f63a"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Reusable Components ---

const ArticleCard = ({ article, isAdmin, onDelete, onEdit }) => (
    <div className="bg-brand-deep-blue rounded-lg overflow-hidden card-glow border border-gray-800 flex flex-col">
        <img src={article.imageUrl || 'https://placehold.co/600x400/1a202c/d4af37?text=Image'} alt={article.title} className="w-full h-48 object-cover"/>
        <div className="p-6 flex flex-col flex-grow">
            <p className="text-sm text-brand-gray mb-2">{article.category}</p>
            <h3 className="text-xl font-bold mb-3 text-white">{article.title}</h3>
            <p className="text-brand-gray mb-4 flex-grow">{article.description}</p>
            <a href="#" onClick={(e) => e.preventDefault()} className="font-semibold text-brand-gold hover:text-yellow-400 mt-auto">Read More &rarr;</a>
            {isAdmin && (
                <div className="mt-4 flex space-x-2">
                    <button onClick={() => onEdit(article)} className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm">Edit</button>
                    <button onClick={() => onDelete(article.id, 'articles')} className="bg-red-500 text-white px-3 py-1 rounded-md text-sm">Delete</button>
                </div>
            )}
        </div>
    </div>
);

const VideoCard = ({ video, isAdmin, onDelete, onEdit }) => {
    const getYouTubeEmbedUrl = (url) => {
        if (!url) return '';
        let videoId;
        try {
            if (url.includes('youtu.be/')) {
                videoId = new URL(url).pathname.split('/')[1];
            } else {
                videoId = new URL(url).searchParams.get('v');
            }
            if(!videoId) throw new Error("Invalid URL");
        } catch (error) {
            console.error("Invalid YouTube URL:", url);
            return '';
        }
        return `https://www.youtube.com/embed/${videoId}`;
    };

    const embedUrl = getYouTubeEmbedUrl(video.youtubeUrl);

    return (
        <div className="bg-brand-deep-blue rounded-lg overflow-hidden card-glow border border-gray-800">
            <div className="aspect-w-16 aspect-h-9">
                {embedUrl ? (
                    <iframe src={embedUrl} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
                ) : (
                    <div className="w-full h-full bg-black flex items-center justify-center">
                        <p className="text-brand-gray">Invalid YouTube URL</p>
                    </div>
                )}
            </div>
            <div className="p-6">
                <h3 className="text-xl font-bold text-white">{video.title}</h3>
                <p className="text-brand-gray mt-2">{video.description}</p>
                {isAdmin && (
                    <div className="mt-4 flex space-x-2">
                         <button onClick={() => onEdit(video)} className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm">Edit</button>
                        <button onClick={() => onDelete(video.id, 'videos')} className="bg-red-500 text-white px-3 py-1 rounded-md text-sm">Delete</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const AdminPanel = ({ user }) => {
    const [articles, setArticles] = useState([]);
    const [videos, setVideos] = useState([]);
    const [formState, setFormState] = useState({ type: 'article', data: {} });
    const [editingItem, setEditingItem] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const articlesQuery = query(collection(db, 'articles'), orderBy('timestamp', 'desc'));
        const unsubscribeArticles = onSnapshot(articlesQuery, (snapshot) => {
            setArticles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => {
            console.error("Error fetching articles:", err);
            setError("Could not fetch articles. Check Firestore rules and collection name.");
        });

        const videosQuery = query(collection(db, 'videos'), orderBy('timestamp', 'desc'));
        const unsubscribeVideos = onSnapshot(videosQuery, (snapshot) => {
            setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (err) => {
            console.error("Error fetching videos:", err);
            setError("Could not fetch videos. Check Firestore rules and collection name.");
        });

        return () => {
            unsubscribeArticles();
            unsubscribeVideos();
        };
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, data: { ...prev.data, [name]: value } }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const collectionName = formState.type === 'article' ? 'articles' : 'videos';
        
        try {
            if (editingItem) {
                const itemRef = doc(db, collectionName, editingItem.id);
                await updateDoc(itemRef, { ...formState.data, timestamp: serverTimestamp() });
                setEditingItem(null);
            } else {
                await addDoc(collection(db, collectionName), { ...formState.data, timestamp: serverTimestamp() });
            }
            setFormState({ type: formState.type, data: {} });
        } catch (err) {
            console.error("Error submitting data:", err);
            setError(`Submission failed. Please check your Firestore rules and ensure all fields are correct. Details: ${err.message}`);
        }
    };

    const handleDelete = async (id, collectionName) => {
        if (window.confirm('Are you sure you want to delete this item?')) {
            try {
                await deleteDoc(doc(db, collectionName, id));
            } catch (err) {
                console.error("Error deleting item:", err);
                setError(`Delete failed. Check Firestore permissions. Details: ${err.message}`);
            }
        }
    };

    const handleEdit = (item) => {
        const type = item.category ? 'article' : 'video';
        setEditingItem(item);
        setFormState({ type: type, data: item });
        window.scrollTo(0, 0);
    };

    const renderForm = () => (
        <form onSubmit={handleSubmit} className="space-y-4 mb-12">
            <h3 className="text-2xl font-serif text-brand-gold">{editingItem ? 'Edit' : 'Add'} {formState.type === 'article' ? 'Article' : 'Video'}</h3>
            {formState.type === 'article' && (
                <>
                    <input name="title" value={formState.data.title || ''} onChange={handleInputChange} placeholder="Article Title" className="w-full p-2 rounded bg-gray-800 border border-gray-700" required />
                    <input name="category" value={formState.data.category || ''} onChange={handleInputChange} placeholder="Category (e.g., EPIC DECODE)" className="w-full p-2 rounded bg-gray-800 border border-gray-700" required />
                    <input name="imageUrl" value={formState.data.imageUrl || ''} onChange={handleInputChange} placeholder="Image URL" className="w-full p-2 rounded bg-gray-800 border border-gray-700" required />
                    <textarea name="description" value={formState.data.description || ''} onChange={handleInputChange} placeholder="Short Description" className="w-full p-2 rounded bg-gray-800 border border-gray-700" rows="3" required></textarea>
                </>
            )}
            {formState.type === 'video' && (
                <>
                    <input name="title" value={formState.data.title || ''} onChange={handleInputChange} placeholder="Video Title" className="w-full p-2 rounded bg-gray-800 border border-gray-700" required />
                    <input name="youtubeUrl" value={formState.data.youtubeUrl || ''} onChange={handleInputChange} placeholder="Full YouTube URL (e.g., https://www.youtube.com/watch?v=...)" className="w-full p-2 rounded bg-gray-800 border border-gray-700" required />
                    <textarea name="description" value={formState.data.description || ''} onChange={handleInputChange} placeholder="Video Description" className="w-full p-2 rounded bg-gray-800 border border-gray-700" rows="3" required></textarea>
                </>
            )}
            <div className="flex space-x-4">
                <button type="submit" className="bg-brand-gold text-brand-deep-blue font-bold py-2 px-6 rounded-lg hover:bg-yellow-400">{editingItem ? 'Update' : 'Publish'}</button>
                {editingItem && <button type="button" onClick={() => { setEditingItem(null); setFormState({ type: formState.type, data: {} }); }} className="bg-gray-500 text-white font-bold py-2 px-6 rounded-lg">Cancel Edit</button>}
            </div>
        </form>
    );

    return (
        <div className="container mx-auto px-6 py-12">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl md:text-4xl font-serif text-brand-gold">Admin Dashboard</h2>
                <button onClick={() => signOut(auth)} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg">Sign Out</button>
            </div>
            
            {error && <div className="bg-red-900 border border-red-700 text-white p-4 rounded-lg mb-6">{error}</div>}

            <div className="bg-brand-deep-blue/50 p-8 rounded-lg border border-gray-800">
                <div className="flex space-x-4 mb-6 border-b border-gray-700">
                    <button onClick={() => { setEditingItem(null); setFormState({ type: 'article', data: {} }); }} className={`py-2 px-4 ${formState.type === 'article' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-brand-gray'}`}>Manage Articles</button>
                    <button onClick={() => { setEditingItem(null); setFormState({ type: 'video', data: {} }); }} className={`py-2 px-4 ${formState.type === 'video' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-brand-gray'}`}>Manage Videos</button>
                </div>
                {renderForm()}
            </div>

            <div className="mt-16">
                <h3 className="text-2xl font-serif text-brand-gold mb-8">Published Articles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {articles.map(article => <ArticleCard key={article.id} article={article} isAdmin={true} onDelete={handleDelete} onEdit={handleEdit} />)}
                </div>
            </div>

            <div className="mt-16">
                <h3 className="text-2xl font-serif text-brand-gold mb-8">Published Videos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {videos.map(video => <VideoCard key={video.id} video={video} isAdmin={true} onDelete={handleDelete} onEdit={handleEdit} />)}
                </div>
            </div>
        </div>
    );
};

const AuthScreen = ({ setPage }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-brand-deep-blue">
            <div className="w-full max-w-md p-8 space-y-6 bg-black/20 rounded-lg shadow-lg">
                <h2 className="text-3xl font-serif text-brand-gold text-center">{isSignUp ? 'Create Admin Account' : 'Admin Login'}</h2>
                <form onSubmit={handleAuth} className="space-y-4">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white" required />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white" required />
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button type="submit" className="w-full bg-brand-gold text-brand-deep-blue font-bold py-3 px-8 rounded-lg text-lg hover:bg-yellow-400">{isSignUp ? 'Sign Up' : 'Sign In'}</button>
                </form>
                <div className="text-center">
                    <button onClick={() => setIsSignUp(!isSignUp)} className="text-brand-gray hover:text-brand-gold text-sm">
                        {isSignUp ? 'Already have an account? Sign In' : 'First time here? Create an account'}
                    </button>
                    <button onClick={() => setPage('home')} className="block mx-auto mt-4 text-brand-gray hover:text-brand-gold text-sm">
                        &larr; Back to Main Site
                    </button>
                </div>
            </div>
        </div>
    );
};

const PublicWebsite = ({ setPage }) => {
    const [articles, setArticles] = useState([]);
    const [videos, setVideos] = useState([]);

    useEffect(() => {
        const articlesQuery = query(collection(db, 'articles'), orderBy('timestamp', 'desc'));
        const videosQuery = query(collection(db, 'videos'), orderBy('timestamp', 'desc'));
        
        const unsubArticles = onSnapshot(articlesQuery, (snapshot) => {
            setArticles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const unsubVideos = onSnapshot(videosQuery, (snapshot) => {
            setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubArticles();
            unsubVideos();
        };
    }, []);

    return (
        <>
            {/* Hero Section */}
            <section className="hero-bg min-h-screen flex items-center">
                <div className="container mx-auto px-6 text-center">
                    <h1 className="text-4xl md:text-7xl font-serif font-bold text-white mb-4 leading-tight">Breaking the Barrier Between Story and Spectator</h1>
                    <p className="text-lg md:text-xl text-brand-light max-w-3xl mx-auto">
                        Diving deep into the narratives of ancient epics and modern cinema. We decode the symbols, explore the philosophies, and reveal the stories behind the stories.
                    </p>
                </div>
            </section>

            {/* Articles Section */}
            <section id="articles" className="py-20 bg-black bg-opacity-20">
                <div className="container mx-auto px-6">
                    <h2 className="text-3xl md:text-4xl font-serif text-brand-gold mb-12 text-center">Latest Articles</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {articles.length > 0 ? articles.map(article => <ArticleCard key={article.id} article={article} />) : <p className="text-brand-gray col-span-full text-center">No articles published yet. Check back soon!</p>}
                    </div>
                </div>
            </section>

            {/* YouTube Section */}
            <section id="youtube" className="py-20">
                <div className="container mx-auto px-6">
                    <h2 className="text-3xl md:text-4xl font-serif text-brand-gold mb-12 text-center">From Our Channel</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {videos.length > 0 ? videos.map(video => <VideoCard key={video.id} video={video} />) : <p className="text-brand-gray col-span-full text-center">No videos published yet. Check back soon!</p>}
                    </div>
                </div>
            </section>
            
             {/* Footer */}
            <footer className="bg-black bg-opacity-30 py-12">
                <div className="container mx-auto px-6 text-center text-brand-gray">
                    <p className="text-sm">
                        <button onClick={() => setPage('auth')} className="hover:text-brand-gold">Admin Login</button>
                    </p>
                    <p className="text-sm mt-4">&copy; 2024 The Fourth Wall. All Rights Reserved.</p>
                </div>
            </footer>
        </>
    );
};


export default function App() {
    const [page, setPage] = useState('home'); // 'home', 'auth', 'admin'
    const [user, setUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if(authReady) {
            if (user) {
                setPage('admin');
            } else if (page === 'admin') {
                setPage('home');
            }
        }
    }, [user, authReady, page]);

    const renderPage = () => {
        if (!authReady) {
            return <div className="min-h-screen flex items-center justify-center bg-brand-deep-blue text-brand-gold text-xl">Loading...</div>;
        }

        switch (page) {
            case 'auth':
                return <AuthScreen setPage={setPage} />;
            case 'admin':
                return user ? <AdminPanel user={user} /> : <AuthScreen setPage={setPage} />;
            case 'home':
            default:
                return <PublicWebsite setPage={setPage} />;
        }
    };

    return (
        <div className="bg-brand-deep-blue text-brand-light font-sans">
            {renderPage()}
        </div>
    );
}
