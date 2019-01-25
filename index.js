import React, {Component} from "react"
import {
    NativeModules,
    View,
    Modal,
    Text,
    TouchableOpacity,
    Dimensions,
    StyleSheet,
    Image,
    Alert,
    Platform,
    Linking,
    ImageBackground,
    StatusBar,
    ToastAndroid,
    ScrollView
} from "react-native"

const {RNUpdateApp} = NativeModules
const RNFS = require("react-native-fs")
const {width, height} = Dimensions.get("window")
const isIOS = Platform.OS == "ios"


class RNUpdate extends Component {
    // Define default properties
    static defaultProps = {
        progressBarColor: "#f50",
        updateBoxWidth: 250,
        updateBoxHeight: 250,
        updateBtnHeight: 38,
        updateBtnText: "立即更新",
        theme: 1,
        bannerWidth: 250,
        bannerHeight: 120,
        bannerResizeMode: 'contain',
        successTips: "", // Tips for successful package download
        errorTips: "", // Download the error message
        CancelTips: "", // User prompt to cancel the upgrade
        bannerImage: require('./theme/1/banner.png'),
        closeImage: require('./theme/1/close.png'),
    }

    constructor(props) {
        super(props)
        this.state = {
            progress: 0,
            modalVisible: false,
            desc: [], //Release Notes
            fileSize: -1,
        }

        this.jobId = 0 // Download task id，Used to stop downloading
        this.fetchRes = {} // Remotely requesting updated json data

        this.loading = false // Is it in the download?

        this.filePath = ''
    }

    async componentWillMount() {
        if (this.props.onBeforeStart) {
            let res = await this.props.onBeforeStart()
            // console.log('res')
            this.checkUpdate(res)
        }
    }

    reset() {
        this.setState({
            progress: 0,
            modalVisible: false,
            desc: [], //更新说明
            fileSize: -1,
        })

        this.jobId = 0 // Download task id，用来停止下载
        this.fetchRes = {} // Used to stop downloading

        this.loading = false // Is it in the download?
    }

    checkUpdate(fetchRes, isManual) {
        try {
            this.fetchRes = fetchRes
            let {version, desc} = fetchRes

            // Installation package download directory

            if (!Array.isArray(desc)) {
                desc = [desc]
            }


            if (version > RNUpdateApp.appVersion) {
                try {
                    RNUpdateApp.getFileSize(this.fetchRes.url).then(async fileSize => {
                        fileSize = Number(fileSize / 1024 / 1024).toFixed(2, 10)

                        this.setState({
                            modalVisible: true,
                            desc,
                            fileSize
                        })
                    })
                } catch (e) {
                    this.setState({
                        modalVisible: true,
                        desc
                    })
                }
            } else {
                if (isManual) {
                    ToastAndroid.show("Already the latest version",
                        ToastAndroid.SHORT,
                        ToastAndroid.BOTTOM
                    )
                }
            }
        } catch (e) {
            console.warn('react-native-update-app check update error', e)
        }
    }

    errorTips = () => {
        ToastAndroid.show("installation failed",
            ToastAndroid.SHORT,
            ToastAndroid.BOTTOM
        )
    }

    androidUpdate = async () => {
        let _this = this
        const {url, filename, version} = this.fetchRes
        // Generate md5 file identifier according to directory/package name/file name

        this.filePath = `${RNFS.ExternalDirectoryPath}/${filename}${version}.apk`

        // Check if the package has been downloaded, if it is, install it directly
        let exist = await RNFS.exists(this.filePath)
        if (exist) {
            RNUpdateApp.install(this.filePath)
            this.hideModal()
            return
        }

        // Download apk and install
        RNFS.downloadFile({
            fromUrl: url,
            toFile: this.filePath,
            progressDivider: 2,   // Throttling
            begin(res) {
                _this.jobId = res.jobId   // Set jobId，Used to pause and resume download tasks
                this.loading = true
            },
            progress(res) {
                let progress = (res.bytesWritten / res.contentLength).toFixed(2, 10)
                // Here this points to a problem and needs to use _this
                _this.setState({
                    progress
                })
            }
        }).promise.then(response => {
            // After the download is complete
            this.hideModal()
            if (response.statusCode == 200) {
                // console.log("FILES UPLOADED!") // response.statusCode, response.headers, response.body
                RNUpdateApp.install(this.filePath)

            } else {
                // Prompt installation failed, close the upgrade window
                this.errorTips()
            }

            this.loading = false
        })
            .catch(err => {
                if (err.description == "cancegetFileSizelled") {
                    this.errorTips()
                }
                this.hideModal()
            })
    }


    updateApp = () => {
        // If you have already started downloading
        if (this.loading) return
        // If it is android
        if (!isIOS) {
            this.androidUpdate()
            return
        }

        let {url} = this.fetchRes
        // If it is ios, open the appstore connection
        Linking.openURL(url).catch(err =>
            console.warn("An error occurred", err)
        )
    }
    // stopUpdateApp = () => {
    //     this.jobId && RNFS.stopDownload(this.jobId)
    // }
    hideModal = () => {
        this.setState({
            modalVisible: false
        })
        this.jobId && RNFS.stopDownload(this.jobId)
    }

    componentWillUnmount() {
        this.hideModal()
    }

    renderBottom = () => {
        let {progress} = this.state
        let {
            progressBarColor,
            updateBtnHeight,
            updateBoxWidth,
            updateBtnText
        } = this.props
        if (progress > 0 && progress < 1) {
            return (
                <View style={styles.progressBar}>
                    <View
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            backgroundColor: progressBarColor,
                            height: 3,
                            width: progress * updateBoxWidth,
                        }}
                    />
                    <Text style={styles.updateBtnText}>Downloading {parseInt(progress * 100, 10)}%</Text>
                </View>
            )
        }
        return (
            <TouchableOpacity onPress={this.updateApp}>
                <View style={styles.updateBtn}>
                    <Text style={styles.updateBtnText}>{progress == 1 ? '安装' : updateBtnText}</Text>
                </View>
            </TouchableOpacity>
        )
    }

    renderCloseBtn = () => {
        let {closeImage, updateBoxWidth, updateBoxHeight} = this.props
        return (
            <View
                style={{
                    position: "absolute",
                    right: (width - updateBoxWidth) / 2 - 16,
                    top: (height - updateBoxHeight) / 2 - 16,
                    zIndex: 1,
                    width: 32,
                    height: 32,
                    backgroundColor: "#e6e6e6",
                    borderRadius: 16
                }}
            >
                <TouchableOpacity
                    onPress={this.hideModal}
                    style={{
                        width: 32,
                        height: 32,
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                >
                    <Image
                        source={closeImage}
                        style={{width: 20, height: 20}}
                    />
                </TouchableOpacity>
            </View>
        )
    }

    renderBanner = () => {
        let {bannerImage, bannerWidth, bannerHeight, bannerResizeMode} = this.props
        return (
            <View style={{height: bannerHeight}}>
                <Image
                    style={{
                        width: bannerWidth,
                        height: bannerHeight,
                        resizeMode: bannerResizeMode
                    }}
                    source={bannerImage}>
                </Image>
            </View>
        )
    }

    renderFileSize = () => {
        let {fileSize} = this.state
        if (!isIOS) {
            return <Text>File size：{fileSize}M</Text>
        }
    }

    render() {
        let {modalVisible, progress, desc } = this.state
        let {updateBoxWidth, updateBoxHeight} = this.props
        return (
            <Modal
                animationType={"fade"}
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => {
                }}
            >
                <View style={styles.wrap}>
                    {this.renderCloseBtn()}
                    <View
                        style={[
                            styles.innerBox,
                            {width: updateBoxWidth, height: updateBoxHeight}
                        ]}>
                        {this.renderBanner()}
                        <View style={{width: updateBoxWidth, height: 85}}>
                            <ScrollView style={{paddingLeft: 10, paddingRight: 10}}>
                                {this.renderFileSize()}
                                <Text>Description：</Text>
                                {desc &&
                                desc.map((d, i) => {
                                    return (
                                        <Text key={i}>{i + 1 + ". " + d}</Text>
                                    )
                                })}
                            </ScrollView>
                        </View>
                        {this.renderBottom()}
                    </View>
                </View>
            </Modal>
        )
    }
}

const styles = StyleSheet.create({
    wrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.3)"
    },
    innerBox: {
        backgroundColor: "#fff",
        borderRadius: 5,
        alignItems: "center",
        justifyContent: "space-around",
        borderWidth: 1,
        borderColor: "#eee",
        overflow: "hidden"
    },
    updateBtn: {
        borderTopWidth: 1,
        borderTopColor: "#eee",
        width: 250,
        height: 38,
        alignItems: "center",
        justifyContent: "center"
    },
    updateBtnText: {
        fontSize: 13,
        color: "#f50"
    },
    progressBar: {
        borderTopWidth: 1,
        borderTopColor: "#eee",
        width: 250,
        height: 37,
        alignItems: "center",
        justifyContent: 'center',

    },

})

export default RNUpdate
