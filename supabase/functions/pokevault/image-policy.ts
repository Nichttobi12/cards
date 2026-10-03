export function hasAssignedImage(card:any){return !!(card?.image||card?.verifiedImageUrl||card?.customImageUrl||card?.customPhotoId);}
export class PhotoLockedError extends Error {constructor(){super('Für diese Karte ist bereits ein Bild vorhanden. Nur Administratoren können es ändern.');this.name='PhotoLockedError';}}
