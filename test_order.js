const { get_resource_data } = require('./src/getResourceData.js');

get_resource_data('unfoldingWord', 'en_obs', 'v9')
  .then((result) => {
    const storyKeys = Object.keys(result['obs'].stories);
    console.log('First 5 story keys:', storyKeys.slice(0, 5));
    console.log('Keys 10-15:', storyKeys.slice(9, 15));

    const firstStory = result['obs'].stories['01'];
    if (firstStory) {
      const frameKeys = Object.keys(firstStory.frames);
      console.log('\nFirst 5 frame keys for story 01:', frameKeys.slice(0, 5));
      console.log('Frame keys 10-15:', frameKeys.slice(9, 15));
    }
  })
  .catch((err) => console.error(err));
