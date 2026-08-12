// Sync isPro state strictly with logged-in Clerk user metadata & Stripe email history
useEffect(() => {
  if (user) {
    if (user.publicMetadata?.isPro) {
      setIsPro(true);
    } else {
      // User is logged in but not marked Pro in Clerk yet.
      // Check if their email address matches a past Stripe purchase!
      const userEmail = user.primaryEmailAddress?.emailAddress;
      if (userEmail) {
        fetch('/api/sync-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, email: userEmail }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.isPro) {
              setIsPro(true);
            }
          })
          .catch((err) => console.error('Error checking past purchases:', err));
      }
    }
  } else {
    setIsPro(false);
  }
}, [user]);