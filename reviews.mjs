export async function getGoogleReviews(){
  const token = process.env.GBP_ACCESS_TOKEN;
  const location = process.env.GBP_LOCATION_NAME;
  if(!token || !location){
    return {configured:false, averageRating:5, totalReviewCount:266, reviews:[]};
  }
  let pageToken = '';
  const reviews = [];
  let averageRating = 5, totalReviewCount = 266;
  do{
    const url = new URL(`https://mybusiness.googleapis.com/v4/${location}/reviews`);
    url.searchParams.set('pageSize','50'); url.searchParams.set('orderBy','rating desc');
    if(pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, {headers:{Authorization:`Bearer ${token}`, Accept:'application/json'}});
    const data = await res.json();
    if(!res.ok) throw new Error(data?.error?.message || 'Google Business Profile API error');
    averageRating = data.averageRating ?? averageRating;
    totalReviewCount = data.totalReviewCount ?? totalReviewCount;
    for(const review of data.reviews || []){
      const rating = ({ONE:1,TWO:2,THREE:3,FOUR:4,FIVE:5})[review.starRating] || Number(review.rating) || 0;
      if(rating >= 4) reviews.push({...review, rating});
    }
    pageToken = data.nextPageToken || '';
  }while(pageToken);
  return {configured:true, averageRating, totalReviewCount, reviews};
}
