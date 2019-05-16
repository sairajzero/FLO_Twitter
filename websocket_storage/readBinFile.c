
#include <stdio.h>
#include <stdlib.h>

struct tweetData
{
  int id;
  char data[5000];
};

int main()
{
  struct tweetData tweet;
  FILE *fptr;
  fptr = fopen("tweet.bin","rb");
  if(fptr == NULL){
    printf("Error in opening tweet file\n");
    return 1;
  }
  while(fread(&tweet,sizeof(tweet),1,fptr))
    printf("%d\t:%s\n", tweet.id,tweet.data);
  fclose(fptr);
  return 0;
}