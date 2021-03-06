const InstallSeededRandom = (function InstallationWrapper({autoInstall=false}){

    const ALREADY_INSTALLED = "Cannot install seeded random. Seeded random is already installed into 'Math' object";
    const BAD_SEED = value => `Value (${value}) could not be parsed into type 'number'`;

    /*
        m = 2^53 - 1  (Half range)
        n = 2^31 - 1  (Magic/Seed)
        r = m * 2     (Range)

        Formula:
        i -> m + ((((m + i) * m / n) % m + i + m) % m - m) / m * r

        Explanation:
        Extend seed values far beyond the safe integer range
        of JavaScript (2^53 - 1) to rely on
        floating point error to produce
        deterministic drifting of seed values.
        Then, perform a linear interpolation to
        map the values back to the seeded range.

        There is one constant that requires a large
        value to enforce a uniform distrubtion.
        A mersenne prime (2^31 - 1) has been chosen
        because it is of the same forumla of the range value,
        and due to the properties of being prime.
        However, this is not necessarily rquired.
    */

    const magic = Math.pow(2,31) - 1;
    const max =   Math.pow(2,53) - 1;
    const range = max * 2;

    const DEFAULT_SEED_METHOD = seed => {
        seed = max + seed;
        seed = ((seed * max / magic) % max + seed) % max - max;
        return max + seed / max * range;
    };

    const SEED_TEST = function(method,startSeed=0,testSize=10000) {
        let values = new Array(testSize);
        let seed = startSeed;
        for(let i = 0;i<testSize;i++) {
            seed = method.call(null,seed);
            values[i] = seed;
        }
        return values;
    };

    let installed = false;

    function SafeRandomInstaller(seedMethod) {
        if(installed) {
            throw Error(ALREADY_INSTALLED);
        }
        installed = true;

        if(seedMethod === undefined) {
            seedMethod = DEFAULT_SEED_METHOD;
        }

        const max = Number.MAX_SAFE_INTEGER;
        const floatify = integer => (integer / max + 1) / 2;
        const unfloatify = float => float * max * 2 - max;

        Math.random = (function SeededRandomScope(){
            const pureRandom = Math.random;

            let randomMethod = pureRandom;
            let seed = 0;
            const updateSeedValue = value => {
                seed = value;
            };

            const seedGenerator = seedMethod;
            const seedRandom = () => {
                const result = seedGenerator.call(null,seed);
                updateSeedValue(result);
                return floatify(result);
            };

            const applyPureRandom = () => {
                randomMethod = pureRandom;
            };
            const applySeededRandom = () => {
                randomMethod = seedRandom;
            };
            const getRandom = () => {
                return randomMethod.call();
            };

            return Object.defineProperties(function randomMethodRouter(){
                return getRandom();
            },{
                mode: {
                    get: function() {
                        if(randomMethod === pureRandom) {
                            return "pure";
                        } else {
                            return "seed";
                        }
                    }
                },
                seedTest: {
                    value: function(count,testSeed) {
                        console.warn("Seed testing is not for production uses!");

                        testSeed = testSeed !== undefined ? testSeed : seed;
                        const results = SEED_TEST(
                            seedGenerator,testSeed,count
                        );

                        const values = results.map(floatify);
                        let largestIndex = null;
                        let smallestIndex = null;
                        const testResults = {
                            largest: values.reduce((oldValue,newValue,index)=>{
                                if(newValue > oldValue) {
                                    largestIndex = index;
                                    return newValue;
                                } else {
                                    return oldValue;
                                }
                            }),
                            smallest: values.reduce((oldValue,newValue,index)=>{
                                if(newValue < oldValue) {
                                    smallestIndex = index;
                                    return newValue;
                                } else {
                                    return oldValue;
                                }
                            }),
                            average: values.reduce((oldValue,newValue)=>{
                                return oldValue + newValue;
                            }) / values.length,
                            raw: {
                                values: values,
                                largestSeed: largestIndex,
                                smallestIndex, smallestIndex,
                                results: results
                            }
                        };

                        return testResults;
                    },
                    writable: false
                },
                generateSeed: {
                    value: function updateSeedWithPure() {
                        updateSeedValue(unfloatify(pureRandom.call()));
                        return seed;
                    },
                    writable: false
                },
                getSeeded: {
                    value: seedGenerator,
                    writable: false
                },
                getPure: {
                    value: pureRandom,
                    writable: false
                },
                purify: {
                    value: applyPureRandom,
                    writable: false
                },
                seedify: {
                    value: applySeededRandom,
                    writable: false
                },
                seed: {
                    get: function getSeed() {
                        return seed;
                    },
                    set: function setSeed(value) {
                        const parsedValue = Number(value);
                        if(isNaN(parsedValue)) {
                            throw TypeError(BAD_SEED(value));
                        }
                        updateSeedValue(parsedValue);
                    }
                }
            });
        })();
    }

    if(autoInstall) {
        SafeRandomInstaller();
    }

    return SafeRandomInstaller;
})({autoInstall: ENV_FLAGS.INSTALL_SEEDED_RANDOM});
