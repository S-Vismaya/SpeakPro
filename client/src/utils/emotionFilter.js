export function extMap(oldMins, newEmotions, compare) {
    if (oldMins.length == 0) return newEmotions;
    const newMinEmotions = [];
    for (let i = 0; i < newEmotions.length; i++) {
      const newEmotion = newEmotions[i];
      for (let j = 0; j < newEmotions.length; j++) {
        const oldMin = oldMins[j];
        if (oldMin.name == newEmotion.name) {
          newMinEmotions.push(
            compare(newEmotion.score, oldMin.score) ? newEmotion : oldMin
          );
        }
      }
    }
    return newMinEmotions;
  }

export function sortAndFilterEmotions(emotions, cutoff) {
    return emotions
    .slice() // Create a shallow copy to avoid mutating the original array
    .sort((a, b) => b.score - a.score) // Sort in descending order by score
    .slice(0, cutoff)
}